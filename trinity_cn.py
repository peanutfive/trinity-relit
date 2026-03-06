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

try:
    from google import genai
except ImportError:
    print("错误：需要安装 google-genai 包")
    print("运行: pip3 install google-genai")
    sys.exit(1)

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

    def send(self, command):
        if self.proc.poll() is not None:
            return
        self.proc.stdin.write((command + "\n").encode("utf-8"))
        self.proc.stdin.flush()

    @property
    def alive(self):
        return self.proc.poll() is None

    def kill(self):
        if self.alive:
            self.proc.terminate()


class Translator:
    """使用 Google Gemini 进行游戏文本的中英互译。"""

    def __init__(self, api_key):
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

    def to_command(self, chinese_input):
        chinese_input = chinese_input.strip()
        if not chinese_input:
            return ""

        if chinese_input.isascii():
            return chinese_input

        if chinese_input in COMMAND_MAP:
            return COMMAND_MAP[chinese_input]

        prompt = (
            "你是 Infocom 文字冒险游戏命令翻译器。"
            "将中文指令翻译成最简洁的英文游戏命令。\n"
            "常见命令：看→look, 拿X→take X, 检查X→examine X, "
            "打开X→open X, 北→n, 南→s, 东→e, 西→w\n"
            "只输出英文命令本身，不加任何解释或标点。\n\n"
            f"中文指令：{chinese_input}"
        )
        try:
            resp = self.client.models.generate_content(
                model=self.model, contents=prompt
            )
            cmd = resp.text.strip().strip("`").strip('"').strip("'")
            return cmd
        except Exception:
            return chinese_input


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
            game.send("")
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

            english_cmd = translator.to_command(user_input)
            print(f"  [{english_cmd}]")

            game.send(english_cmd)
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
