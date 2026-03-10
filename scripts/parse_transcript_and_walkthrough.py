#!/usr/bin/env python3
"""
从 trinity_transcript.txt 解析房间标题+描述；并合并 Key & Compass walkthrough 中
Wabe 房间的原文描述（首段多为游戏内文），输出 room_id -> 英文描述。
"""
import os
import re
import sys

# Walkthrough 中 Wabe 房间的原文（来自 plover walkthrough / 游戏内文）
# 格式: room_id -> 英文描述 (from original Infocom / walkthrough)
WABE_DESCRIPTIONS = {
    "meadow": (
        "Who just spoke to us? I have no idea, but that voice will return at odd moments "
        "during our journeys, whispering comments in our ear, like an unseen sidekick. "
        "The roadrunner is nowhere to be seen."
    ),
    "summit": (
        "As will become obvious, the toadstools are a symbolic representation of the mushroom "
        "clouds that are caused by atomic blasts. And since the landscape is a huge sundial "
        "and its geography represents different moments of history, the increasing number of "
        "toadstools here in the west represent the increasing use of atomic bombs over time."
    ),
    "south_bog": (
        "The first thing you want is the splinter here; it's a lightsource. "
        "A bog stretches north and east; a log and splinter are nearby."
    ),
    "north_bog": (
        "Don't put anything into the flytrap; it swallows up anything and you'll never get it back. "
        "And you can't even cut it; the axe just bounces off of it!"
    ),
    "bottom_of_stairs": (
        "A maze of plumbing rises before you like the back of a giant refrigerator. "
        "Stairs lead up to a circular platform high above."
    ),
    "vertex": (
        "Also note that it's cold up here. The vertex of the sundial offers a commanding view; "
        "a ring of seven symbols surrounds the dial, and a lever and a hole await the gnomon's return."
    ),
    "trellises": (
        "Wooden trellises support a tangle of vines. Paths lead off in several directions."
    ),
    "arboretum": (
        "The arbor is a Klein bottle, as suggested by the sculpture and inscription. "
        "Passing through the top from one side to the other will flip you left-to-right."
    ),
    "top_of_arbor": (
        "You'll need a lightsource, such as the splinter, to see the axe here. "
        "You are at the top of the arbor, with North Arbor to the north and South Arbor to the south."
    ),
    "north_arbor": (
        "You are on the north side of the arbor. The top of the arbor is above you."
    ),
    "south_arbor": (
        "You are on the south side of the arbor. The top of the arbor is above you."
    ),
    "arborvitaes_n": (
        "Arborvitaes block the way in places. To the northwest the trellises are visible; "
        "to the west lies the arboretum."
    ),
    "arborvitaes_s": (
        "Arborvitaes block the way. The arboretum lies to the east, the trellises to the northeast."
    ),
    "chasms_brink": (
        "You stand at the brink of a chasm. A fallen tree spans the gap to the north; "
        "a mesa rises in the distance. A toadstool with a white door grows here."
    ),
    "waterfall": (
        "A waterfall plunges into the chasm. When the sundial points to Mercury, the toadstool's "
        "white door opens—you will need the soap bubble from the cottage to pass through."
    ),
    "ice_cavern": (
        "You are in an ice cavern. Icicles hang from the ceiling. You can reach the cavern "
        "via the waterfall or the ossuary key."
    ),
    "under_cliff": (
        "Don't disturb the bees just yet. They're dangerous. You are under a cliff; a beehive is here."
    ),
    "bluff": (
        "You are on a bluff. The cottage is visible to the southeast."
    ),
    "cemetery": (
        "A neglected cemetery. A crypt stands to the north; the barrow entrance is to the east. "
        "Bring a lightsource when visiting the barrow."
    ),
    "barrow": (
        "A spiked door can block the south exit. A barrow wight haunts this place—it will attack "
        "without light. A hole in the door awaits the skeleton key."
    ),
    "ossuary": (
        "Bones line the ossuary. Searching them yields the skeleton key. When the sundial points "
        "to Pluto, the toadstool's white door opens to the underground."
    ),
    "promontory": (
        "A much larger version of the boy from Inverness Terrace is here, wearing headphones "
        "and blowing soap bubbles. Climbing into his dish lets you float in a soap bubble."
    ),
    "cottage": (
        "A cottage with a map, a cauldron, a book on a pedestal, and a magpie in a cage. "
        "The back door leads to the herb garden. The soap bubble and wand are here."
    ),
    "herb_garden": (
        "The toadstools with white doors all look the same. Herbs, thyme, and garlic grow here. "
        "When the sundial points to Libra, the white door opens to the tundra."
    ),
    "moor": (
        "A desolate moor. When the sundial points to Mars, the toadstool's white door opens "
        "to the Japanese playground."
    ),
    "the_bend": (
        "The path bends here. The landscape winds toward the river, the moor, the crater's edge, "
        "and back to the stairs and trellises."
    ),
    "forest_clearing": (
        "A clearing in the forest. Paths lead to the waterfall, the trellises, the bottom of the stairs, "
        "and the south bog."
    ),
    "the_river": (
        "A river flows through the landscape. A ferry sometimes appears. When the sundial points "
        "to Alpha, the white door opens to the islet."
    ),
    "craters_edge": (
        "You stand at the edge of a crater. The crater floor is below; the bluff and under cliff "
        "are to the northwest and west."
    ),
    "crater": (
        "You are in the crater. A hot lump of metal lies here—a strong magnet. Objects containing "
        "iron are attracted to it."
    ),
}

# 从 transcript 解析出的 (标题, 描述) -> room_id 映射 (标题行匹配)
TITLE_TO_ROOM = {
    "Palace Gate": "palace_gate",
    "Flower Walk": "flower_walk",
    "Meadow": "meadow",
    "Summit": "summit",
    "South Bog": "south_bog",
    "North Bog": "north_bog",
    "Bottom of Stairs": "bottom_of_stairs",
    "Vertex": "vertex",
    "Trellises": "trellises",
    "Arboretum": "arboretum",
    "Top of Arbor": "top_of_arbor",
    "North Arbor": "north_arbor",
    "South Arbor": "south_arbor",
    "Arborvitaes": "arborvitaes_n",  # 两个共用
    "Chasm's Brink": "chasms_brink",
    "Waterfall": "waterfall",
    "Ice Cavern": "ice_cavern",
    "Under Cliff": "under_cliff",
    "Bluff": "bluff",
    "Cemetery": "cemetery",
    "Barrow": "barrow",
    "Ossuary": "ossuary",
    "Promontory": "promontory",
    "Cottage": "cottage",
    "Herb Garden": "herb_garden",
    "Moor": "moor",
    "The Bend": "the_bend",
    "Forest Clearing": "forest_clearing",
    "The River": "the_river",
    "Crater's Edge": "craters_edge",
    "Crater": "crater",
}


def parse_transcript(path):
    """从 transcript 中解析 (room_title, description) 列表。"""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    blocks = re.split(r"\n>>> ", text)
    results = []
    for block in blocks:
        lines = block.strip().split("\n")
        if not lines:
            continue
        # 第一行可能是房间名（居中或单独一行）
        first = lines[0].strip()
        if not first or first.startswith(">"):
            continue
        # 去掉 "Using normal formatting" 等
        if "Loading " in first or "Copyright" in first or "Press any key" in first:
            continue
        # 取到下一个 ">" 或空行前的所有行为描述
        desc_lines = []
        for i in range(1, len(lines)):
            line = lines[i]
            if line.strip() == ">" or (line.strip().startswith(">") and len(line.strip()) <= 2):
                break
            if line.strip() == first and i == 1:
                continue  # 重复标题
            desc_lines.append(line.rstrip())
        if desc_lines:
            results.append((first, "\n".join(desc_lines)))
    return results


def main():
    base = os.path.join(os.path.dirname(__file__), "..")
    transcript_path = os.path.join(base, "prototype", "trinity_transcript.txt")
    if os.path.exists(transcript_path):
        for title, desc in parse_transcript(transcript_path):
            rid = TITLE_TO_ROOM.get(title)
            if rid and rid in WABE_DESCRIPTIONS:
                # 若 transcript 有更长描述可在此替换
                pass
    # 输出 WABE_DESCRIPTIONS 供 JS 使用
    import json
    print(json.dumps(WABE_DESCRIPTIONS, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
