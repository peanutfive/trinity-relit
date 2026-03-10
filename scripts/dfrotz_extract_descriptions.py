#!/usr/bin/env python3
"""
用 dfrotz 运行 Trinity，发送命令并录制输出，用于提取房间/物品英文描述。
用法:
  python scripts/dfrotz_extract_descriptions.py [--commands FILE] [--output TRANSCRIPT.txt]
若未提供 --commands，则只发送 verbose + look 并退出（用于测试）。
"""
import os
import sys
import time
import subprocess
import queue
import threading

DFROTZ = "dfrotz"
GAME_PATH = os.path.join(os.path.dirname(__file__), "..", "Trinity 1986", "TRINITY.DAT")


class DfrotzRunner:
    def __init__(self, game_path):
        if not os.path.exists(game_path):
            raise FileNotFoundError(f"Game not found: {game_path}")
        self.proc = subprocess.Popen(
            [DFROTZ, "-m", "-w", "80", game_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        self._q = queue.Queue()
        self._thread = threading.Thread(target=self._reader, daemon=True)
        self._thread.start()

    def _reader(self):
        while True:
            b = self.proc.stdout.read(1)
            if not b:
                self._q.put(None)
                break
            try:
                self._q.put(b.decode("utf-8"))
            except UnicodeDecodeError:
                self._q.put("?")

    def read_response(self, timeout=5.0, settle=0.5):
        buf = []
        last = time.time()
        while True:
            try:
                ch = self._q.get(timeout=0.1)
                if ch is None:
                    break
                buf.append(ch)
                last = time.time()
            except queue.Empty:
                if buf and (time.time() - last) > settle:
                    break
                if time.time() - last > timeout:
                    break
        return "".join(buf)

    def send(self, cmd):
        if self.proc.poll() is not None:
            return
        self.proc.stdin.write((cmd.strip() + "\n").encode("utf-8"))
        self.proc.stdin.flush()

    def kill(self):
        if self.proc.poll() is None:
            self.proc.terminate()


def main():
    import argparse
    p = argparse.ArgumentParser(description="Run dfrotz and record transcript")
    p.add_argument("--commands", "-c", help="Command file (one command per line)")
    p.add_argument("--output", "-o", default="prototype/trinity_transcript.txt", help="Transcript output path")
    p.add_argument("--game", default=GAME_PATH, help="Path to TRINITY.DAT")
    args = p.parse_args()

    runner = DfrotzRunner(args.game)
    out_path = os.path.join(os.path.dirname(__file__), "..", args.output.lstrip("./"))
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    transcript = []

    try:
        time.sleep(1.2)
        first = runner.read_response(timeout=6.0)
        transcript.append(("", first))
        runner.send("")
        time.sleep(0.6)
        r2 = runner.read_response(timeout=5.0)
        transcript.append(("", r2))
        runner.send("verbose")
        time.sleep(0.4)
        transcript.append(("verbose", runner.read_response(timeout=3.0)))

        if not args.commands:
            runner.send("look")
            time.sleep(0.5)
            transcript.append(("look", runner.read_response(timeout=3.0)))
        else:
            cmd_path = os.path.join(os.path.dirname(__file__), "..", args.commands.lstrip("./"))
            with open(cmd_path, "r", encoding="utf-8") as f:
                commands = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
            for i, cmd in enumerate(commands):
                runner.send(cmd)
                time.sleep(0.35)
                resp = runner.read_response(timeout=4.0)
                transcript.append((cmd, resp))
                if i % 20 == 0 and i:
                    print(f"  ... {i}/{len(commands)}", file=sys.stderr)
    finally:
        runner.kill()

    with open(out_path, "w", encoding="utf-8") as f:
        for cmd, resp in transcript:
            f.write(f"\n>>> {cmd}\n\n")
            f.write(resp)
            f.write("\n")
    print(f"Transcript written to {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
