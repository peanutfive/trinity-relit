#!/usr/bin/env python3
"""
Z-machine v4/v5 story file parser.
Extracts: header, abbreviations, object tree, properties, dictionary, grammar.
Outputs JSON to stdout.
"""

import sys
import json
import struct

# ── ZSCII alphabet tables (v3+) ──
A0 = list("      abcdefghijklmnopqrstuvwxyz")
A1 = list("      ABCDEFGHIJKLMNOPQRSTUVWXYZ")
A2 = list("       \n0123456789.,!?_#'\"/\\-:()")
# Positions 0–5 are control chars; 6 in A2 = ZSCII escape


class ZMachineParser:
    def __init__(self, data: bytes):
        self.data = data
        self.version = data[0]
        assert self.version in (4, 5), f"Unsupported version {self.version}"
        self._parse_header()
        self._parse_abbreviations()

    # ── Low-level readers ──

    def byte(self, addr):
        return self.data[addr]

    def word(self, addr):
        return (self.data[addr] << 8) | self.data[addr + 1]

    def packed_addr(self, paddr):
        if self.version <= 3:
            return paddr * 2
        if self.version <= 5:
            return paddr * 2
        if self.version <= 7:
            return (paddr * 2) + self.routine_offset
        return paddr * 4

    # ── Header ──

    def _parse_header(self):
        d = self.data
        self.release = self.word(2)
        self.high_mem = self.word(4)
        self.initial_pc = self.word(6)
        self.dict_addr = self.word(8)
        self.obj_table = self.word(10)
        self.globals_addr = self.word(12)
        self.static_mem = self.word(14)
        self.abbrev_addr = self.word(24)
        self.serial = d[18:24].decode("ascii", errors="replace")

    def header_info(self):
        return {
            "version": self.version,
            "release": self.release,
            "serial": self.serial,
            "high_mem": hex(self.high_mem),
            "initial_pc": hex(self.initial_pc),
            "dict_addr": hex(self.dict_addr),
            "obj_table": hex(self.obj_table),
            "globals_addr": hex(self.globals_addr),
            "static_mem": hex(self.static_mem),
            "abbrev_addr": hex(self.abbrev_addr),
        }

    # ── Abbreviations ──

    def _parse_abbreviations(self):
        n = 96 if self.version >= 3 else 32
        self.abbreviations = []
        for i in range(n):
            waddr = self.word(self.abbrev_addr + i * 2)
            text, _ = self._decode_zscii(waddr * 2, abbrev=False)
            self.abbreviations.append(text)

    # ── ZSCII text decoding ──

    def _decode_zscii(self, addr, abbrev=True):
        """Decode ZSCII text at byte address. Returns (text, next_addr)."""
        zchars = []
        pos = addr
        while True:
            w = self.word(pos)
            zchars.append((w >> 10) & 0x1F)
            zchars.append((w >> 5) & 0x1F)
            zchars.append(w & 0x1F)
            pos += 2
            if w & 0x8000:
                break

        text = []
        alphabet = 0
        i = 0
        while i < len(zchars):
            z = zchars[i]
            i += 1

            if z == 0:
                text.append(" ")
                continue

            if z in (1, 2, 3) and abbrev:
                if i < len(zchars):
                    idx = 32 * (z - 1) + zchars[i]
                    i += 1
                    if idx < len(self.abbreviations):
                        text.append(self.abbreviations[idx])
                continue

            if z == 4:
                alphabet = 1
                continue
            if z == 5:
                alphabet = 2
                continue

            if alphabet == 2 and z == 6:
                if i + 1 < len(zchars):
                    hi = zchars[i]
                    lo = zchars[i + 1]
                    i += 2
                    code = (hi << 5) | lo
                    text.append(chr(code))
                alphabet = 0
                continue

            if 6 <= z <= 31:
                tbl = (A0, A1, A2)[alphabet]
                text.append(tbl[z])
            alphabet = 0

        return "".join(text), pos

    def decode_text(self, addr):
        t, _ = self._decode_zscii(addr)
        return t

    # ── Object Table ──

    def _obj_entry_addr(self, obj_num):
        if self.version <= 3:
            return self.obj_table + 62 + (obj_num - 1) * 9
        prop_defaults_size = 63 * 2
        return self.obj_table + prop_defaults_size + (obj_num - 1) * 14

    def _obj_count(self):
        first_obj_addr = self._obj_entry_addr(1)
        if self.version <= 3:
            first_prop = self.word(first_obj_addr + 7)
        else:
            first_prop = self.word(first_obj_addr + 12)
        if self.version <= 3:
            return (first_prop - first_obj_addr) // 9
        return (first_prop - first_obj_addr) // 14

    def parse_object(self, obj_num):
        addr = self._obj_entry_addr(obj_num)

        if self.version <= 3:
            attrs_bytes = self.data[addr:addr + 4]
            parent = self.byte(addr + 4)
            sibling = self.byte(addr + 5)
            child = self.byte(addr + 6)
            prop_addr = self.word(addr + 7)
        else:
            attrs_bytes = self.data[addr:addr + 6]
            parent = self.word(addr + 6)
            sibling = self.word(addr + 8)
            child = self.word(addr + 10)
            prop_addr = self.word(addr + 12)

        attrs = set()
        for byte_idx, b in enumerate(attrs_bytes):
            for bit in range(8):
                if b & (0x80 >> bit):
                    attrs.add(byte_idx * 8 + bit)

        name_len = self.byte(prop_addr)
        if name_len > 0:
            name, _ = self._decode_zscii(prop_addr + 1)
        else:
            name = ""

        props_start = prop_addr + 1 + name_len * 2
        properties = self._parse_properties(props_start)

        return {
            "num": obj_num,
            "name": name,
            "attrs": sorted(list(attrs)),
            "parent": parent,
            "sibling": sibling,
            "child": child,
            "properties": properties,
            "_prop_addr": hex(prop_addr),
        }

    def _parse_properties(self, addr):
        props = {}
        pos = addr
        while True:
            size_byte = self.byte(pos)
            if size_byte == 0:
                break

            if self.version <= 3:
                prop_num = size_byte & 0x1F
                prop_len = (size_byte >> 5) + 1
                pos += 1
            else:
                if size_byte & 0x80:
                    prop_num = size_byte & 0x3F
                    pos += 1
                    len_byte = self.byte(pos)
                    prop_len = len_byte & 0x3F
                    if prop_len == 0:
                        prop_len = 64
                    pos += 1
                else:
                    prop_num = size_byte & 0x3F
                    prop_len = 1 if not (size_byte & 0x40) else 2
                    pos += 1

            prop_data = self.data[pos:pos + prop_len]
            val_hex = prop_data.hex()

            val_int = None
            if prop_len == 1:
                val_int = prop_data[0]
            elif prop_len == 2:
                val_int = (prop_data[0] << 8) | prop_data[1]

            props[prop_num] = {
                "len": prop_len,
                "hex": val_hex,
                "int": val_int,
                "addr": hex(pos),
            }
            pos += prop_len

        return props

    def all_objects(self):
        count = self._obj_count()
        objs = []
        for i in range(1, count + 1):
            try:
                objs.append(self.parse_object(i))
            except (IndexError, AssertionError):
                break
        return objs

    # ── Dictionary ──

    def parse_dictionary(self):
        pos = self.dict_addr
        n_sep = self.byte(pos)
        pos += 1
        separators = [chr(self.byte(pos + i)) for i in range(n_sep)]
        pos += n_sep

        entry_len = self.byte(pos)
        pos += 1
        n_entries = self.word(pos)
        pos += 2

        entries = []
        text_bytes = 4 if self.version <= 3 else 6
        for _ in range(n_entries):
            word_text, _ = self._decode_zscii(pos, abbrev=False)
            extra = self.data[pos + text_bytes:pos + entry_len]
            entries.append({
                "word": word_text.strip(),
                "extra_hex": extra.hex(),
                "addr": hex(pos),
            })
            pos += entry_len

        return {
            "separators": separators,
            "entry_length": entry_len,
            "count": n_entries,
            "entries": entries,
        }

    # ── Globals ──

    def global_var(self, n):
        return self.word(self.globals_addr + n * 2)

    def all_globals(self, count=240):
        return {i: self.global_var(i) for i in range(count)}

    # ── High-level text extraction ──

    def extract_all_strings(self, start=None, end=None):
        """Scan memory for valid ZSCII strings in the high memory region."""
        if start is None:
            start = self.high_mem
        if end is None:
            end = len(self.data)

        strings = []
        pos = start
        while pos < end - 1:
            try:
                text, next_pos = self._decode_zscii(pos)
                if len(text) >= 3 and any(c.isalpha() for c in text):
                    strings.append({
                        "addr": hex(pos),
                        "text": text,
                    })
                pos = next_pos
            except (IndexError, KeyError):
                pos += 2
        return strings

    def extract_print_strings(self):
        """Find all inline strings after print/print_ret opcodes (0xb2/0xb3)."""
        strings = []
        pos = 0
        end = len(self.data) - 2
        while pos < end:
            b = self.data[pos]
            if b in (0xB2, 0xB3):
                opname = "print" if b == 0xB2 else "print_ret"
                str_addr = pos + 1
                try:
                    text, next_pos = self._decode_zscii(str_addr)
                    if text.strip():
                        strings.append({
                            "op_addr": hex(pos),
                            "str_addr": hex(str_addr),
                            "opcode": opname,
                            "text": text,
                        })
                    pos = next_pos
                except (IndexError, KeyError):
                    pos += 1
            else:
                pos += 1
        return strings


def main():
    if len(sys.argv) < 2:
        print("Usage: python zparse.py <story.dat> [--strings] [--dict] [--objects] [--all]")
        sys.exit(1)

    filename = sys.argv[1]
    flags = set(sys.argv[2:])
    if not flags:
        flags = {"--all"}

    with open(filename, "rb") as f:
        data = f.read()

    zm = ZMachineParser(data)
    result = {"header": zm.header_info()}

    if "--objects" in flags or "--all" in flags:
        objs = zm.all_objects()
        result["objects"] = objs
        result["object_count"] = len(objs)

    if "--dict" in flags or "--all" in flags:
        result["dictionary"] = zm.parse_dictionary()

    if "--strings" in flags or "--all" in flags:
        result["strings"] = zm.extract_all_strings()

    if "--globals" in flags:
        result["globals"] = zm.all_globals()

    json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
