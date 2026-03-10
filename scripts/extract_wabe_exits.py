#!/usr/bin/env python3
"""
从 zparse.py 输出的 objects JSON 中提取 Wabe 30 个房间的出口连通图。
方向属性: 52=out, 53=in, 54=down, 55=up, 56=nw, 57=w, 58=sw, 59=s, 60=se, 61=e, 62=ne, 63=n
2 字节值 = 目标房间 obj#；3+ 字节 = 条件/阻挡，忽略。
"""
import json
import sys
import os

# CHAPTER_PLAN.md 中的 Obj# -> room_id
WABE_OBJ_TO_ROOM = {
    576: "meadow",
    323: "summit",
    319: "south_bog",
    42: "north_bog",
    575: "bottom_of_stairs",
    316: "vertex",
    317: "trellises",
    462: "arboretum",
    408: "top_of_arbor",
    4: "north_arbor",
    430: "south_arbor",
    418: "arborvitaes_n",
    580: "arborvitaes_s",
    306: "chasms_brink",
    472: "waterfall",
    449: "ice_cavern",
    400: "under_cliff",
    213: "bluff",
    414: "cemetery",
    353: "barrow",
    522: "ossuary",
    370: "promontory",
    327: "cottage",
    417: "herb_garden",
    471: "moor",
    557: "the_bend",
    426: "forest_clearing",
    565: "the_river",
    441: "craters_edge",
    145: "crater",
}

DIR_PROPS = {
    52: "out",
    53: "in",
    54: "down",
    55: "up",
    56: "nw",
    57: "w",
    58: "sw",
    59: "s",
    60: "se",
    61: "e",
    62: "ne",
    63: "n",
}


def main():
    path = os.path.join(os.path.dirname(__file__), "..", "prototype", "trinity_objects.json")
    if len(sys.argv) > 1:
        path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    objs = {o["num"]: o for o in data["objects"]}
    obj_to_room = WABE_OBJ_TO_ROOM
    room_to_obj = {v: k for k, v in obj_to_room.items()}

    # 所有可能是目标房间的 obj#（Wabe 30 + 可能连到 prologue 等）
    all_room_nums = set(obj_to_room.keys())
    # 也收集所有在 objects 里出现且被引用的 obj
    for o in data["objects"]:
        for pnum, p in o.get("properties", {}).items():
            if p.get("len") == 2 and p.get("int") is not None:
                all_room_nums.add(p["int"])

    exits_by_room = {}
    for obj_num, room_id in obj_to_room.items():
        if obj_num not in objs:
            print(f"Warning: obj {obj_num} ({room_id}) not in objects", file=sys.stderr)
            exits_by_room[room_id] = {}
            continue
        o = objs[obj_num]
        props = o.get("properties", {})
        exits = {}
        for pnum in range(52, 64):
            if str(pnum) not in props:
                continue
            p = props[str(pnum)]
            if p.get("len") != 2 or p.get("int") is None:
                continue
            target_num = p["int"]
            dir_name = DIR_PROPS.get(pnum)
            if not dir_name:
                continue
            target_room = obj_to_room.get(target_num)
            if target_room:
                exits[dir_name] = target_room
            else:
                exits[dir_name] = f"obj#{target_num}"
        exits_by_room[room_id] = exits

    # 输出 JSON 便于程序化使用
    print(json.dumps(exits_by_room, indent=2, ensure_ascii=False))

    # 同时打印每个房间的出口，便于人工核对
    print("\n# Per-room exits (obj# -> room_id)", file=sys.stderr)
    for room_id in sorted(exits_by_room.keys(), key=lambda r: (room_to_obj.get(r, 0), r)):
        ex = exits_by_room[room_id]
        obj_num = room_to_obj.get(room_id)
        print(f"  {room_id} (obj {obj_num}): {ex}", file=sys.stderr)


if __name__ == "__main__":
    main()
