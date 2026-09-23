#!/usr/bin/env python3
"""
Trinity (1986) 中文翻译版
通过 Google Gemini AI 实时翻译，让你用中文玩 Infocom 经典文字冒险游戏。
"""

import subprocess
import threading
import queue
import time
import sys
import os
import json
import re
from dataclasses import InitVar, dataclass
try:
    from google import genai
except ImportError:
    # Keep the command compiler importable for offline tests. The CLI still
    # reports the missing optional dependency when Translator is constructed.
    genai = None

GAME_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "Trinity 1986", "Trinity 1986", "TRINITY.DAT"
)
DFROTZ = "dfrotz"

COMMAND_MAP = {
    "北": "n", "南": "s", "东": "e", "西": "w",
    "上": "u", "下": "d", "看": "look", "环顾": "look",
    "拿": "take", "取": "take", "放下": "drop",
    "打开": "open", "关闭": "close", "关": "close",
    "检查": "examine", "仔细看": "examine", "查看": "examine",
    "背包": "inventory", "物品": "inventory",
    "等": "wait", "等待": "wait",
    "存档": "save", "读档": "restore", "载入": "restore",
    "退出": "quit", "帮助": "help",
    "往北走": "n", "往南走": "s", "往东走": "e", "往西走": "w",
    "上去": "u", "下去": "d", "进去": "enter", "出去": "exit",
    "东北": "ne", "西北": "nw", "东南": "se", "西南": "sw",
    "是": "yes", "不": "no", "否": "no",
}


class CommandRejected(ValueError):
    """A command was not safe enough to send to the game interpreter."""


_TERM_RE = re.compile(r"^[a-z0-9]+(?:[ '-][a-z0-9]+)*$")
_USER_COMMAND_RE = re.compile(r"^[A-Za-z0-9]+(?:[ '-][A-Za-z0-9]+)*$")
_MAX_COMMAND_LENGTH = 120
_MAX_MODEL_RESPONSE_LENGTH = 512
_RENDER_TOKEN = object()
_MULTI_COMMAND_TOKENS = frozenset({"and", "then"})

_DIRECTION_ALIASES = {
    "n": "n", "north": "n", "s": "s", "south": "s",
    "e": "e", "east": "e", "w": "w", "west": "w",
    "u": "u", "up": "u", "d": "d", "down": "d",
    "ne": "ne", "northeast": "ne", "nw": "nw", "northwest": "nw",
    "se": "se", "southeast": "se", "sw": "sw", "southwest": "sw",
    "in": "in", "out": "out",
}
_NO_OBJECT_VERBS = frozenset({
    "look", "inventory", "wait", "score", "quit", "yes", "no",
    "save", "restore", "restart", "help", "verbose", "brief", "exit",
})
_OBJECT_VERBS = frozenset({
    "take", "drop", "open", "close", "examine", "read", "wear",
    "remove", "enter", "climb", "push", "pull", "turn", "move",
    "search", "touch", "smell", "listen", "attack", "kiss", "wake",
})
_RELATION_VERBS = {
    "look": frozenset({"at"}),
    "put": frozenset({"in", "on"}),
    "give": frozenset({"to"}),
    "show": frozenset({"to"}),
    "throw": frozenset({"at", "to"}),
    "unlock": frozenset({"with"}),
    "lock": frozenset({"with"}),
    "cut": frozenset({"with"}),
}
_MODEL_KEYS = frozenset({"verb", "object", "preposition", "indirect_object"})


def _normalise_term(value, label):
    if not isinstance(value, str):
        raise CommandRejected(f"{label} 必须是字符串")
    value = value.lower()
    if not value or len(value) > _MAX_COMMAND_LENGTH or not _TERM_RE.fullmatch(value):
        raise CommandRejected(f"{label} 含有不受支持的字符")
    if _MULTI_COMMAND_TOKENS.intersection(value.split()):
        raise CommandRejected(f"{label} 含有多命令连接词")
    return value


@dataclass(frozen=True)
class CommandVocabulary:
    """Trusted terms visible in the current dfrotz scene.

    ``scene`` contains fixed scenery nouns, ``items`` contains portable or
    interactive object nouns, and ``exits`` contains direction names. Empty
    groups are valid; ``reliable=False`` prevents model command compilation.
    """

    scene: tuple = ()
    items: tuple = ()
    exits: tuple = ()
    reliable: bool = False

    def __post_init__(self):
        if not isinstance(self.reliable, bool):
            raise CommandRejected("词表 reliable 标记必须是布尔值")
        for label, terms in (("场景词", self.scene), ("物品词", self.items), ("出口词", self.exits)):
            if not isinstance(terms, (tuple, list)):
                raise CommandRejected(f"{label}表必须是数组")
        scene = tuple(_normalise_term(term, "场景词") for term in self.scene)
        items = tuple(_normalise_term(term, "物品词") for term in self.items)
        exits = []
        for term in self.exits:
            normalised = _normalise_term(term, "出口词")
            try:
                exits.append(_DIRECTION_ALIASES[normalised])
            except KeyError as exc:
                raise CommandRejected(f"未知出口词: {normalised}") from exc
        object.__setattr__(self, "scene", tuple(dict.fromkeys(scene)))
        object.__setattr__(self, "items", tuple(dict.fromkeys(items)))
        object.__setattr__(self, "exits", tuple(dict.fromkeys(exits)))

    @property
    def objects(self):
        return frozenset(self.scene + self.items)


@dataclass(frozen=True)
class CompiledCommand:
    """A single command that has passed schema validation and rendering."""

    text: str
    _proof: InitVar[object] = None

    def __post_init__(self, _proof):
        if _proof is not _RENDER_TOKEN:
            raise CommandRejected("CompiledCommand 只能由 renderer 创建")
        if not isinstance(self.text, str) or not _USER_COMMAND_RE.fullmatch(self.text):
            raise CommandRejected("渲染结果不是合法的单条命令")
        if len(self.text) > _MAX_COMMAND_LENGTH:
            raise CommandRejected("命令过长")

    def __str__(self):
        return self.text


def _reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise CommandRejected(f"模型 JSON 含重复字段: {key}")
        result[key] = value
    return result


def _render_payload(payload, vocabulary=None, require_vocabulary=False):
    if not isinstance(payload, dict) or set(payload) != _MODEL_KEYS:
        raise CommandRejected("命令必须严格符合四字段 JSON schema")

    verb = _normalise_term(payload["verb"], "动词")
    direct = payload["object"]
    preposition = payload["preposition"]
    indirect = payload["indirect_object"]
    for label, value in (
        ("object", direct), ("preposition", preposition),
        ("indirect_object", indirect),
    ):
        if value is not None and not isinstance(value, str):
            raise CommandRejected(f"{label} 必须是字符串或 null")

    direct = _normalise_term(direct, "直接宾语") if direct is not None else None
    preposition = _normalise_term(preposition, "介词") if preposition is not None else None
    indirect = _normalise_term(indirect, "间接宾语") if indirect is not None else None

    direction = _DIRECTION_ALIASES.get(verb)
    if direction:
        if any(value is not None for value in (direct, preposition, indirect)):
            raise CommandRejected("方向命令不能包含其他字段")
        verb = direction
    elif verb in _NO_OBJECT_VERBS:
        if verb == "look" and direct is not None:
            if preposition != "at" or indirect is not None:
                raise CommandRejected("look 的宾语形式必须是 look at <object>")
        elif any(value is not None for value in (direct, preposition, indirect)):
            raise CommandRejected(f"{verb} 不接受宾语")
    elif verb in _OBJECT_VERBS:
        if preposition is not None or indirect is not None:
            raise CommandRejected(f"{verb} 不接受介词或间接宾语")
    elif verb in _RELATION_VERBS:
        if direct is None or indirect is None or preposition not in _RELATION_VERBS[verb]:
            raise CommandRejected(f"{verb} 的命令结构无效")
    else:
        raise CommandRejected(f"不允许的动词: {verb}")

    if require_vocabulary:
        if vocabulary is None or not isinstance(vocabulary, CommandVocabulary):
            raise CommandRejected("缺少显式场景/物品/出口词表")
        if not vocabulary.reliable:
            raise CommandRejected("场景/物品/出口词表未标记为可靠")
        if direction and verb not in vocabulary.exits:
            raise CommandRejected(f"当前词表没有出口: {verb}")
        for noun in (direct, indirect):
            if noun is not None and noun not in vocabulary.objects:
                raise CommandRejected(f"当前词表没有对象: {noun}")

    parts = [verb]
    if direct is not None:
        if verb == "look":
            parts.extend(("at", direct))
        else:
            parts.append(direct)
    if preposition is not None and verb != "look":
        parts.extend((preposition, indirect))
    return CompiledCommand(" ".join(parts), _RENDER_TOKEN)


def compile_model_command(model_text, vocabulary):
    """Validate strict model JSON and render one dfrotz command."""
    if not isinstance(model_text, str):
        raise CommandRejected("模型回复必须是文本")
    if not model_text or len(model_text) > _MAX_MODEL_RESPONSE_LENGTH:
        raise CommandRejected("模型回复为空或过长")
    if not model_text.isascii() or any(ord(ch) < 32 or ord(ch) == 127 for ch in model_text):
        raise CommandRejected("模型回复含非 ASCII 字符、换行或控制字符")
    if ";" in model_text or "&&" in model_text or "||" in model_text:
        raise CommandRejected("模型回复疑似包含多条命令")
    try:
        payload = json.loads(model_text, object_pairs_hook=_reject_duplicate_keys)
    except CommandRejected:
        raise
    except (json.JSONDecodeError, TypeError) as exc:
        raise CommandRejected("模型回复不是单个合法 JSON 对象") from exc
    return _render_payload(payload, vocabulary, require_vocabulary=True)


def compile_user_command(command, vocabulary=None):
    """Compile a direct English command without trusting raw text downstream."""
    if not isinstance(command, str):
        raise CommandRejected("命令必须是字符串")
    if command != command.strip() or not _USER_COMMAND_RE.fullmatch(command):
        raise CommandRejected("命令含换行、分隔符或不受支持的字符")
    words = command.lower().split()
    if not words:
        raise CommandRejected("命令为空")
    verb = words[0]
    payload = {"verb": verb, "object": None, "preposition": None, "indirect_object": None}

    if verb in _DIRECTION_ALIASES or verb in _NO_OBJECT_VERBS:
        if verb == "look" and len(words) > 1:
            if len(words) < 3 or words[1] != "at":
                raise CommandRejected("look 的宾语形式必须是 look at <object>")
            payload["object"] = " ".join(words[2:])
            payload["preposition"] = "at"
        elif len(words) != 1:
            raise CommandRejected(f"{verb} 后存在多余内容")
    elif verb in _OBJECT_VERBS:
        payload["object"] = " ".join(words[1:]) or None
    elif verb in _RELATION_VERBS:
        allowed = _RELATION_VERBS[verb]
        positions = [i for i, word in enumerate(words[1:], 1) if word in allowed]
        if len(positions) != 1:
            raise CommandRejected(f"{verb} 必须包含一个受支持的介词")
        position = positions[0]
        payload["object"] = " ".join(words[1:position]) or None
        payload["preposition"] = words[position]
        payload["indirect_object"] = " ".join(words[position + 1:]) or None
    else:
        raise CommandRejected(f"不允许的动词: {verb}")

    needs_vocabulary = payload["object"] is not None or payload["indirect_object"] is not None
    return _render_payload(payload, vocabulary, require_vocabulary=needs_vocabulary)


class GameRunner:
    """管理 dfrotz 子进程，处理游戏输入输出。"""

    def __init__(self, game_path):
        if not os.path.exists(game_path):
            print(f"错误：找不到游戏文件 {game_path}")
            sys.exit(1)

        self.proc = subprocess.Popen(
            [DFROTZ, "-m", "-w", "80", game_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        self._queue = queue.Queue()
        self._thread = threading.Thread(target=self._reader, daemon=True)
        self._thread.start()

    def _reader(self):
        while True:
            byte = self.proc.stdout.read(1)
            if not byte:
                self._queue.put(None)
                break
            try:
                self._queue.put(byte.decode("utf-8"))
            except UnicodeDecodeError:
                self._queue.put("?")

    def read_response(self, timeout=3.0, settle=0.4):
        """读取游戏输出，直到它停下来等待输入。"""
        chars = []
        last_recv = time.time()

        while True:
            try:
                ch = self._queue.get(timeout=0.1)
                if ch is None:
                    break
                chars.append(ch)
                last_recv = time.time()
            except queue.Empty:
                elapsed = time.time() - last_recv
                if chars and elapsed > settle:
                    break
                if elapsed > timeout:
                    break

        text = "".join(chars)
        # 清理 dfrotz 的 > 提示符
        lines = text.split("\n")
        cleaned = []
        for line in lines:
            stripped = line.strip()
            if stripped == ">":
                continue
            if stripped.startswith(">"):
                cleaned.append(stripped[1:].strip())
            else:
                cleaned.append(line)
        return "\n".join(cleaned).strip()

    def _write(self, data):
        if self.proc.poll() is not None:
            return
        self.proc.stdin.write(data)
        self.proc.stdin.flush()

    def send_keypress(self):
        """Send the one startup keypress requested by Trinity."""
        self._write(b"\n")

    def send_command(self, command):
        """Send only a command produced by the validated renderer."""
        if not isinstance(command, CompiledCommand):
            raise TypeError("dfrotz only accepts CompiledCommand values")
        self._write((command.text + "\n").encode("ascii"))

    @property
    def alive(self):
        return self.proc.poll() is None

    def kill(self):
        if self.alive:
            self.proc.terminate()


class Translator:
    """使用 Google Gemini 进行游戏文本的中英互译。"""

    def __init__(self, api_key=None, client=None):
        if client is not None:
            self.client = client
        elif genai is None:
            raise RuntimeError("需要安装 google-genai 包: pip3 install google-genai")
        else:
            self.client = genai.Client(api_key=api_key)
        self.model = "gemini-2.0-flash"

    def to_chinese(self, english_text):
        if not english_text.strip():
            return ""

        prompt = (
            "你是 Infocom 文字冒险游戏 \"Trinity\"(1986) 的翻译器。"
            "请将以下游戏输出翻译成优美流畅的简体中文。\n"
            "要求：\n"
            "1. 保持原文的文学风格、氛围和段落结构\n"
            "2. 地点名称保留英文，括号附中文，如 Palace Gate（宫门）\n"
            "3. 方向提示附英文缩写：北(n)、南(s)、东(e)、西(w)、上(u)、下(d)、"
            "东北(ne)、西北(nw)、东南(se)、西南(sw)\n"
            "4. 不要添加任何解释、注释或额外内容\n\n"
            f"英文原文：\n{english_text}"
        )
        try:
            resp = self.client.models.generate_content(
                model=self.model, contents=prompt
            )
            return resp.text.strip()
        except Exception as e:
            return f"[翻译出错: {e}]\n\n原文：\n{english_text}"

    def to_command(self, chinese_input, vocabulary=None):
        chinese_input = chinese_input.strip()
        if not chinese_input:
            raise CommandRejected("命令为空")

        if chinese_input.isascii():
            return compile_user_command(chinese_input, vocabulary)

        if chinese_input in COMMAND_MAP:
            return compile_user_command(COMMAND_MAP[chinese_input], vocabulary)

        if vocabulary is None or not isinstance(vocabulary, CommandVocabulary):
            raise CommandRejected("缺少显式场景/物品/出口词表，未调用模型")
        if not vocabulary.reliable:
            raise CommandRejected("场景/物品/出口词表不可靠，未调用模型")

        prompt = (
            "你是 Infocom 文字冒险游戏命令翻译器。"
            "把中文指令编译为一条命令的严格 JSON 对象。\n"
            "对象必须且只能包含 verb、object、preposition、indirect_object 四个字段；"
            "后三个字段不用时必须为 null。不要输出 Markdown、解释或换行。\n"
            "只能使用提供的场景词、物品词和出口词；不要发明名词或出口。\n"
            f"可信词表：{json.dumps({'scene': vocabulary.scene, 'items': vocabulary.items, 'exits': vocabulary.exits})}\n"
            f"中文指令：{chinese_input}"
        )
        try:
            resp = self.client.models.generate_content(
                model=self.model, contents=prompt
            )
        except Exception as exc:
            raise CommandRejected("模型调用失败，命令未发送") from exc
        return compile_model_command(resp.text, vocabulary)


HELP_TEXT = """
╔══════════════════════════════════════════╗
║         Trinity 中文版 - 帮助           ║
╠══════════════════════════════════════════╣
║  你可以输入中文或英文指令：             ║
║                                          ║
║  方向：北/南/东/西/上/下                 ║
║        东北/西北/东南/西南               ║
║  动作：看、拿、放下、打开、关闭         ║
║        检查、背包、等待                  ║
║  系统：存档、读档、退出                  ║
║                                          ║
║  也可以输入完整的中文句子，如：          ║
║    "拿起白色的伞" → take white umbrella  ║
║    "仔细看那棵大树" → examine tree       ║
║                                          ║
║  输入 /原文  显示上次的英文原文          ║
║  输入 /帮助  显示此帮助信息              ║
╚══════════════════════════════════════════╝
"""


def main():
    print()
    print("═" * 56)
    print("   ✦  Trinity (1986) — 中文翻译版  ✦")
    print("   通过 Google Gemini AI 实时翻译")
    print("═" * 56)
    print()

    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("本脚本需要 Google Gemini API Key 进行翻译。")
        print("免费获取：https://aistudio.google.com/apikey")
        print()
        api_key = input("请输入你的 Gemini API Key: ").strip()
        if not api_key:
            print("未输入 API Key，退出。")
            sys.exit(1)

    print("\n正在初始化翻译引擎...")
    translator = Translator(api_key)

    print("正在启动游戏...\n")
    game = GameRunner(GAME_PATH)

    last_english = ""

    try:
        # 处理开头的 "[Press any key to begin.]"
        time.sleep(1)
        intro = game.read_response(timeout=5.0)
        if intro:
            last_english = intro
            # 发送回车跳过 "Press any key"
            game.send_keypress()
            time.sleep(0.5)
            opening = game.read_response(timeout=5.0)
            if opening:
                last_english = intro + "\n\n" + opening
                combined = last_english
            else:
                combined = intro
            print(translator.to_chinese(combined))

        print(HELP_TEXT)

        while game.alive:
            try:
                user_input = input("\n>> ").strip()
            except EOFError:
                break

            if not user_input:
                continue

            if user_input == "/原文":
                print(f"\n--- 英文原文 ---\n{last_english}\n--- 原文结束 ---")
                continue

            if user_input in ("/帮助", "/help"):
                print(HELP_TEXT)
                continue

            try:
                english_cmd = translator.to_command(user_input)
            except CommandRejected as exc:
                print(f"  [命令被拒绝: {exc}]")
                continue
            print(f"  [{english_cmd.text}]")

            game.send_command(english_cmd)
            time.sleep(0.3)
            response = game.read_response()

            if response:
                last_english = response
                chinese = translator.to_chinese(response)
                print()
                print(chinese)
            else:
                print("  (游戏没有回应)")

    except KeyboardInterrupt:
        print("\n\n游戏中断。再见！")
    finally:
        game.kill()
        print("\n游戏已退出。")


if __name__ == "__main__":
    main()
