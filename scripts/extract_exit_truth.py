#!/usr/bin/env python3
"""从 trinity_objects.json 还原房间出口真值表。

属性 52-63 为方向。取值有三种形式：
  len == 2  直接出口，值即目标房间对象号
  len == 6  条件出口，前 2 字节为目标房间对象号，后续为消息/条件
  其它      纯 routine，无法在不反汇编的情况下确定目标

用法:
  python3 scripts/extract_exit_truth.py                 # 输出互洽率自检
  python3 scripts/extract_exit_truth.py --json out.json # 导出真值表
  python3 scripts/extract_exit_truth.py --room 414      # 查单个房间
"""
import argparse
import json
from collections import Counter

DIRS = {
    "63": "n", "62": "ne", "61": "e", "60": "se",
    "59": "s", "58": "sw", "57": "w", "56": "nw",
    "55": "up", "54": "down", "53": "in", "52": "out",
}
REVERSE = {
    "n": "s", "s": "n", "e": "w", "w": "e",
    "ne": "sw", "sw": "ne", "nw": "se", "se": "nw",
    "up": "down", "down": "up", "in": "out", "out": "in",
}
ROOM_PARENT = 88
ROOM_ATTR = 44
# 属性 37 是「有光照」，不是房间标志。把它当作房间判定条件会漏掉
# Top of Arbor、Underground ×3、Underwater 这 5 个黑暗房间。
LIT_ATTR = 37


def load(path="trinity_objects.json"):
    with open(path) as handle:
        objects = json.load(handle)["objects"]
    return {obj["num"]: obj for obj in objects}


def is_room(obj):
    return obj["parent"] == ROOM_PARENT and ROOM_ATTR in obj["attrs"]


def exits_of(obj, rooms):
    """返回 {dir: target_num} 与 {dir: 'routine'}，后者目标未知。"""
    resolved, opaque = {}, {}
    for prop, direction in DIRS.items():
        value = obj["properties"].get(prop)
        if not value:
            continue
        if value["len"] == 2 and value["int"] in rooms:
            resolved[direction] = value["int"]
        elif value["len"] == 6:
            target = int(value["hex"][:4], 16)
            if target in rooms:
                resolved[direction] = target
            else:
                opaque[direction] = value["hex"]
        else:
            opaque[direction] = value["hex"]
    return resolved, opaque


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--objects", default="trinity_objects.json")
    parser.add_argument("--json")
    parser.add_argument("--room", type=int)
    args = parser.parse_args()

    objects = load(args.objects)
    rooms = {num: obj for num, obj in objects.items() if is_room(obj)}

    table = {}
    for num, obj in rooms.items():
        resolved, opaque = exits_of(obj, rooms)
        table[num] = {
            "name": obj["name"],
            "dark": LIT_ATTR not in obj["attrs"],
            "exits": resolved,
            "opaque": opaque,
        }

    if args.room:
        entry = table.get(args.room)
        if not entry:
            raise SystemExit(f"#{args.room} 不是房间对象")
        print(f"#{args.room} {entry['name']}")
        for direction, target in entry["exits"].items():
            print(f"  {direction:4} -> #{target} {table[target]['name']}")
        for direction, raw in entry["opaque"].items():
            print(f"  {direction:4} -> [routine {raw}]")
        return

    if args.json:
        with open(args.json, "w") as handle:
            json.dump(table, handle, ensure_ascii=False, indent=2)
        print(f"已写入 {args.json}（{len(table)} 个房间）")
        return

    # 自检：解析出的出口里，有多少能形成合法双向对。
    # 高互洽率说明 len==6 取前 2 字节的解读成立。
    stats = Counter()
    for num, entry in table.items():
        for direction, target in entry["exits"].items():
            back = REVERSE.get(direction)
            if not back:
                continue
            counterpart = table[target]["exits"].get(back)
            if counterpart == num:
                stats["互洽"] += 1
            elif back in table[target]["opaque"]:
                stats["反向为 routine"] += 1
            elif counterpart is None:
                stats["反向缺失"] += 1
            else:
                stats["反向指向他处"] += 1

    total = sum(stats.values())
    print(f"房间总数: {len(table)}")
    print(f"已解析出口: {total}")
    for key, count in stats.most_common():
        print(f"  {key}: {count} ({count / total:.1%})")


if __name__ == "__main__":
    main()
