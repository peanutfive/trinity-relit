#!/usr/bin/env python3
"""Produce an auditable room-description report from a Trinity transcript.

Parsed transcript text and :data:`WABE_DESCRIPTIONS` are deliberately separate
evidence streams.  The latter are hand-written repository notes; this script
does not have a primary source or walkthrough citation with which to verify
them.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


# Existing hand-written notes, not verified quotations.  Do not present their
# presence here as proof of an original Infocom release or named walkthrough.
WABE_DESCRIPTIONS = {
    "meadow": "Who just spoke to us? I have no idea, but that voice will return at odd moments during our journeys, whispering comments in our ear, like an unseen sidekick. The roadrunner is nowhere to be seen.",
    "summit": "As will become obvious, the toadstools are a symbolic representation of the mushroom clouds that are caused by atomic blasts. And since the landscape is a huge sundial and its geography represents different moments of history, the increasing number of toadstools here in the west represent the increasing use of atomic bombs over time.",
    "south_bog": "The first thing you want is the splinter here; it's a lightsource. A bog stretches north and east; a log and splinter are nearby.",
    "north_bog": "Don't put anything into the flytrap; it swallows up anything and you'll never get it back. And you can't even cut it; the axe just bounces off of it!",
    "bottom_of_stairs": "A maze of plumbing rises before you like the back of a giant refrigerator. Stairs lead up to a circular platform high above.",
    "vertex": "Also note that it's cold up here. The vertex of the sundial offers a commanding view; a ring of seven symbols surrounds the dial, and a lever and a hole await the gnomon's return.",
    "trellises": "Wooden trellises support a tangle of vines. Paths lead off in several directions.",
    "arboretum": "The arbor is a Klein bottle, as suggested by the sculpture and inscription. Passing through the top from one side to the other will flip you left-to-right.",
    "top_of_arbor": "You'll need a lightsource, such as the splinter, to see the axe here. You are at the top of the arbor, with North Arbor to the north and South Arbor to the south.",
    "north_arbor": "You are on the north side of the arbor. The top of the arbor is above you.",
    "south_arbor": "You are on the south side of the arbor. The top of the arbor is above you.",
    "arborvitaes_n": "Arborvitaes block the way in places. To the northwest the trellises are visible; to the west lies the arboretum.",
    "arborvitaes_s": "Arborvitaes block the way. The arboretum lies to the east, the trellises to the northeast.",
    "chasms_brink": "You stand at the brink of a chasm. A fallen tree spans the gap to the north; a mesa rises in the distance. A toadstool with a white door grows here.",
    "waterfall": "A waterfall plunges into the chasm. When the sundial points to Mercury, the toadstool's white door opens—you will need the soap bubble from the cottage to pass through.",
    "ice_cavern": "You are in an ice cavern. Icicles hang from the ceiling. You can reach the cavern via the waterfall or the ossuary key.",
    "under_cliff": "Don't disturb the bees just yet. They're dangerous. You are under a cliff; a beehive is here.",
    "bluff": "You are on a bluff. The cottage is visible to the southeast.",
    "cemetery": "A neglected cemetery. A crypt stands to the north; the barrow entrance is to the east. Bring a lightsource when visiting the barrow.",
    "barrow": "A spiked door can block the south exit. A barrow wight haunts this place—it will attack without light. A hole in the door awaits the skeleton key.",
    "ossuary": "Bones line the ossuary. Searching them yields the skeleton key. When the sundial points to Pluto, the toadstool's white door opens to the underground.",
    "promontory": "A much larger version of the boy from Inverness Terrace is here, wearing headphones and blowing soap bubbles. Climbing into his dish lets you float in a soap bubble.",
    "cottage": "A cottage with a map, a cauldron, a book on a pedestal, and a magpie in a cage. The back door leads to the herb garden. The soap bubble and wand are here.",
    "herb_garden": "The toadstools with white doors all look the same. Herbs, thyme, and garlic grow here. When the sundial points to Libra, the white door opens to the tundra.",
    "moor": "A desolate moor. When the sundial points to Mars, the toadstool's white door opens to the Japanese playground.",
    "the_bend": "The path bends here. The landscape winds toward the river, the moor, the crater's edge, and back to the stairs and trellises.",
    "forest_clearing": "A clearing in the forest. Paths lead to the waterfall, the trellises, the bottom of the stairs, and the south bog.",
    "the_river": "A river flows through the landscape. A ferry sometimes appears. When the sundial points to Alpha, the white door opens to the islet.",
    "craters_edge": "You stand at the edge of a crater. The crater floor is below; the bluff and under cliff are to the northwest and west.",
    "crater": "You are in the crater. A hot lump of metal lies here—a strong magnet. Objects containing iron are attracted to it.",
}

TITLE_TO_ROOM = {
    "Palace Gate": "palace_gate", "Flower Walk": "flower_walk", "Meadow": "meadow", "Summit": "summit",
    "South Bog": "south_bog", "North Bog": "north_bog", "Bottom of Stairs": "bottom_of_stairs",
    "Vertex": "vertex", "Trellises": "trellises", "Arboretum": "arboretum",
    "Top of Arbor": "top_of_arbor", "North Arbor": "north_arbor", "South Arbor": "south_arbor",
    "Arborvitaes": "arborvitaes_n",  # 两个共用
    "Chasm's Brink": "chasms_brink", "Waterfall": "waterfall", "Ice Cavern": "ice_cavern",
    "Under Cliff": "under_cliff", "Bluff": "bluff", "Cemetery": "cemetery", "Barrow": "barrow",
    "Ossuary": "ossuary", "Promontory": "promontory", "Cottage": "cottage",
    "Herb Garden": "herb_garden", "Moor": "moor", "The Bend": "the_bend",
    "Forest Clearing": "forest_clearing", "The River": "the_river", "Crater's Edge": "craters_edge",
    "Crater": "crater",
}

COMMAND_RE = re.compile(r"^>>>(?:[ \t]*(.*))?$")


@dataclass(frozen=True)
class SourceLine:
    """One decoded UTF-8 source line with a half-open byte span in the file."""

    text: str
    number: int
    byte_start: int
    byte_end: int


@dataclass
class TranscriptFrame:
    command: str
    command_line: SourceLine
    response: list[SourceLine]


def _read_utf8_lines(path: os.PathLike[str] | str) -> list[SourceLine]:
    """Read source lines without losing their original UTF-8 byte positions."""
    data = Path(path).read_bytes()
    lines: list[SourceLine] = []
    byte_start = 0
    for number, raw_line in enumerate(data.splitlines(keepends=True), start=1):
        decoded = raw_line.decode("utf-8")
        text = decoded.rstrip("\r\n")
        # This exact UTF-8 round trip locates content before any newline bytes.
        byte_end = byte_start + len(text.encode("utf-8"))
        lines.append(SourceLine(text, number, byte_start, byte_end))
        byte_start += len(raw_line)
    return lines


def split_transcript_frames(path: os.PathLike[str] | str) -> list[TranscriptFrame]:
    """Split a transcript at literal ``>>> command`` lines.

    Commands are frame metadata, never response text.  This prevents ``>>>
    verbose`` and similar commands from being mistaken for room titles.
    """
    frames: list[TranscriptFrame] = []
    current: TranscriptFrame | None = None
    for line in _read_utf8_lines(path):
        match = COMMAND_RE.fullmatch(line.text)
        if match:
            if current is not None:
                frames.append(current)
            current = TranscriptFrame(match.group(1).strip(), line, [])
        elif current is not None:
            current.response.append(line)
    if current is not None:
        frames.append(current)
    return frames


def _normalise_title(text: str) -> str:
    return " ".join(text.strip().split())


def _description_lines(frame: TranscriptFrame, title_index: int) -> list[SourceLine]:
    """Return outer-trimmed response lines after the selected title."""
    lines = frame.response[title_index + 1 :]
    for index, line in enumerate(lines):
        if line.text.strip() == ">":
            lines = lines[:index]
            break
    while lines and not lines[0].text.strip():
        lines.pop(0)
    while lines and not lines[-1].text.strip():
        lines.pop()
    return lines


def parse_transcript(path: os.PathLike[str] | str) -> list[dict[str, Any]]:
    """Extract known rooms with descriptions and independently checkable provenance.

    Same-title occurrences in separate command frames are all retained.  When a
    frame repeats a known title, its final title is the description boundary;
    earlier candidates remain visible through ``ignored_title_lines``.
    """
    source_path = os.fspath(path)
    records: list[dict[str, Any]] = []
    for frame in split_transcript_frames(path):
        title_candidates = [
            (index, _normalise_title(line.text))
            for index, line in enumerate(frame.response)
            if _normalise_title(line.text) in TITLE_TO_ROOM
        ]
        if not title_candidates:
            continue
        title_index, title = title_candidates[-1]
        description_lines = _description_lines(frame, title_index)
        if not description_lines:
            continue

        selected = frame.response[title_index]
        first, last = description_lines[0], description_lines[-1]
        records.append({
            "room_id": TITLE_TO_ROOM[title],
            "title": title,
            "description": "\n".join(line.text.rstrip() for line in description_lines),
            "source": {
                "kind": "parsed_transcript",
                "path": source_path,
                "encoding": "utf-8",
                "frame": {
                    "command": frame.command,
                    "command_line": frame.command_line.number,
                    "command_byte_start": frame.command_line.byte_start,
                    "command_byte_end": frame.command_line.byte_end,
                },
                "title": {"line": selected.number, "byte_start": selected.byte_start, "byte_end": selected.byte_end},
                "description": {"start_line": first.number, "end_line": last.number, "byte_start": first.byte_start, "byte_end": last.byte_end},
                "ignored_title_lines": [frame.response[index].number for index, _ in title_candidates[:-1]],
            },
        })
    return records


def _hardcoded_wabe_records() -> dict[str, dict[str, Any]]:
    return {
        room_id: {
            "description": description,
            "source": {
                "kind": "hardcoded_wabe_note",
                "location": "WABE_DESCRIPTIONS in scripts/parse_transcript_and_walkthrough.py",
                "verification": "Unverified hand-written repository content; no primary source or walkthrough citation is recorded by this script.",
            },
        }
        for room_id, description in WABE_DESCRIPTIONS.items()
    }


def build_report(path: os.PathLike[str] | str) -> dict[str, Any]:
    """Build a report without automatically combining incompatible source streams."""
    return {
        "schema_version": 1,
        "merge_policy": {
            "strategy": "none",
            "reason": "Parsed transcript text and hardcoded WABE notes have different provenance. This report never substitutes, concatenates, or treats either as verification of the other.",
            "manual_resolution_required": True,
        },
        "parsed_transcript": parse_transcript(path),
        "hardcoded_wabe_descriptions": _hardcoded_wabe_records(),
    }


def main() -> None:
    base = Path(__file__).resolve().parent.parent
    transcript_path = base / "prototype" / "trinity_transcript.txt"
    print(json.dumps(build_report(transcript_path), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
