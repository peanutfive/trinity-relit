import io
import json
import unittest
from contextlib import redirect_stdout
from unittest import mock

import trinity_cn


class FakeModels:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return type("Response", (), {"text": self.response})()


class FakeClient:
    def __init__(self, response=None, error=None):
        self.models = FakeModels(response=response, error=error)


def vocabulary(**overrides):
    values = {
        "scene": ("tree", "door"),
        "items": ("white umbrella", "axe"),
        "exits": ("north", "e"),
        "reliable": True,
    }
    values.update(overrides)
    return trinity_cn.CommandVocabulary(**values)


def model_json(**overrides):
    values = {
        "verb": "take",
        "object": "white umbrella",
        "preposition": None,
        "indirect_object": None,
    }
    values.update(overrides)
    return json.dumps(values, separators=(",", ":"))


class CommandCompilerTests(unittest.TestCase):
    def test_valid_model_json_is_rendered_with_explicit_vocabulary(self):
        client = FakeClient(response=model_json())
        translator = trinity_cn.Translator(client=client)

        command = translator.to_command("拿起白色的伞", vocabulary())

        self.assertIsInstance(command, trinity_cn.CompiledCommand)
        self.assertEqual(command.text, "take white umbrella")
        prompt = client.models.calls[0]["contents"]
        self.assertIn('"white umbrella"', prompt)
        self.assertIn('"n"', prompt)

    def test_missing_or_unreliable_vocabulary_rejects_before_model_call(self):
        client = FakeClient(response=model_json())
        translator = trinity_cn.Translator(client=client)

        with self.assertRaisesRegex(trinity_cn.CommandRejected, "缺少显式"):
            translator.to_command("拿起白色的伞")
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "不可靠"):
            translator.to_command("拿起白色的伞", vocabulary(reliable=False))

        self.assertEqual(client.models.calls, [])

    def test_model_text_cannot_bypass_json_renderer(self):
        translator = trinity_cn.Translator(client=FakeClient(response="take white umbrella"))
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "JSON"):
            translator.to_command("拿起白色的伞", vocabulary())

    def test_schema_is_exact_and_rejects_duplicate_or_wrong_typed_fields(self):
        bad_responses = (
            '{"verb":"take","object":"white umbrella","preposition":null,"indirect_object":null,"extra":1}',
            '{"verb":"take","verb":"drop","object":"white umbrella","preposition":null,"indirect_object":null}',
            '{"verb":"take","object":["white umbrella"],"preposition":null,"indirect_object":null}',
        )
        for response in bad_responses:
            with self.subTest(response=response):
                with self.assertRaises(trinity_cn.CommandRejected):
                    trinity_cn.compile_model_command(response, vocabulary())

    def test_newlines_separators_and_multiple_commands_are_rejected(self):
        bad_responses = (
            model_json() + "\n",
            model_json(object="white umbrella\nquit"),
            model_json(object="white umbrella; quit"),
            model_json(object="white umbrella && quit"),
            model_json() + model_json(verb="quit", object=None),
        )
        for response in bad_responses:
            with self.subTest(response=response):
                with self.assertRaises(trinity_cn.CommandRejected):
                    trinity_cn.compile_model_command(response, vocabulary())

    def test_unknown_objects_and_exits_are_rejected(self):
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "没有对象"):
            trinity_cn.compile_model_command(model_json(object="bomb"), vocabulary())
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "没有出口"):
            trinity_cn.compile_model_command(
                model_json(verb="s", object=None), vocabulary()
            )

    def test_user_ascii_is_compiled_and_multicommand_input_is_rejected(self):
        command = trinity_cn.compile_user_command("look at tree")
        self.assertEqual(command.text, "look at tree")
        for raw in ("look\nquit", "look; quit", "look && quit", "look | quit"):
            with self.subTest(raw=raw):
                with self.assertRaises(trinity_cn.CommandRejected):
                    trinity_cn.compile_user_command(raw, vocabulary())

    def test_direct_english_object_command_needs_no_model_or_vocabulary(self):
        client = FakeClient(response=model_json())
        translator = trinity_cn.Translator(client=client)

        command = translator.to_command("take white umbrella")

        self.assertEqual(command.text, "take white umbrella")
        self.assertEqual(client.models.calls, [])

    def test_player_commands_keep_native_dfrotz_grammar(self):
        for command in (
            "buy bag", "feed birds", "look in pram", "x watch",
            "get coin", "eat crumb", "rub hands",
        ):
            with self.subTest(command=command):
                self.assertEqual(trinity_cn.compile_user_command(command).text, command)
        with self.assertRaises(trinity_cn.CommandRejected):
            trinity_cn.compile_user_command("take ball and drop it")

    def test_classic_single_letter_aliases_are_rendered(self):
        self.assertEqual(trinity_cn.compile_user_command("i").text, "inventory")
        self.assertEqual(trinity_cn.compile_user_command("l").text, "look")
        self.assertEqual(trinity_cn.compile_user_command("z").text, "wait")

    def test_filename_reply_has_a_separate_restricted_renderer(self):
        self.assertEqual(trinity_cn.compile_filename_reply("slot-1.sav").text, "slot-1.sav")
        self.assertEqual(trinity_cn.compile_filename_reply("").text, "")
        for filename in ("../slot", "folder/slot", "slot\nquit", "slot name"):
            with self.subTest(filename=filename):
                with self.assertRaises(trinity_cn.CommandRejected):
                    trinity_cn.compile_filename_reply(filename)

    def test_vocabulary_schema_rejects_strings_and_embedded_newlines(self):
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "必须是数组"):
            trinity_cn.CommandVocabulary(scene="tree", reliable=True)
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "不受支持"):
            trinity_cn.CommandVocabulary(scene=("tree\ndoor",), reliable=True)
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "多命令"):
            trinity_cn.CommandVocabulary(scene=("umbrella then quit",), reliable=True)

    def test_model_failure_never_falls_back_to_user_text(self):
        translator = trinity_cn.Translator(client=FakeClient(error=RuntimeError("offline")))
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "未发送"):
            translator.to_command("拿起白色的伞", vocabulary())


class GameRunnerBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.runner = trinity_cn.GameRunner.__new__(trinity_cn.GameRunner)
        self.runner.proc = type("Process", (), {})()
        self.runner.proc.poll = lambda: None
        self.runner.proc.stdin = io.BytesIO()

    def test_dfrotz_accepts_only_renderer_output(self):
        with self.assertRaises(TypeError):
            self.runner.send_command("take white umbrella")
        self.assertEqual(self.runner.proc.stdin.getvalue(), b"")

        command = trinity_cn.compile_user_command("look")
        self.runner.send_command(command)
        self.assertEqual(self.runner.proc.stdin.getvalue(), b"look\n")

    def test_compiled_command_cannot_be_forged_outside_renderer(self):
        with self.assertRaisesRegex(trinity_cn.CommandRejected, "renderer"):
            trinity_cn.CompiledCommand("quit")

    def test_startup_keypress_has_separate_interface(self):
        self.runner.send_keypress()
        self.assertEqual(self.runner.proc.stdin.getvalue(), b"\n")

    def test_filename_reply_has_a_separate_dfrotz_interface(self):
        with self.assertRaises(TypeError):
            self.runner.send_filename_reply("slot.sav")
        reply = trinity_cn.compile_filename_reply("slot.sav")
        self.runner.send_filename_reply(reply)
        self.assertEqual(self.runner.proc.stdin.getvalue(), b"slot.sav\n")


class MainInteractionTests(unittest.TestCase):
    def test_main_accepts_objects_aliases_and_save_filename_without_model_calls(self):
        class FakeTranslator:
            def to_command(self, text):
                return trinity_cn.compile_user_command(text)

            def to_chinese(self, text):
                return text

        class FakeGame:
            def __init__(self):
                self.alive = True
                self.commands = []
                self.filename_replies = []
                self.responses = iter((
                    "",  # startup
                    "Taken.",
                    "You are carrying a white umbrella.",
                    "Please enter a filename [trinity.sav]:",
                    "Saved.",
                    "Please enter a file name [trinity.sav]:",
                    "Restored.",
                ))
                self.killed = False

            def read_response(self, **_kwargs):
                return next(self.responses)

            def send_command(self, command):
                self.commands.append(command.text)

            def send_filename_reply(self, reply):
                self.filename_replies.append(reply.text)

            def kill(self):
                self.killed = True

        translator = FakeTranslator()
        game = FakeGame()
        user_inputs = (
            "take white umbrella", "i",
            "save", "slot1.sav",
            "restore", "slot1.sav",
            EOFError(),
        )

        with (
            mock.patch.dict(trinity_cn.os.environ, {"GOOGLE_API_KEY": "test-key"}),
            mock.patch.object(trinity_cn, "Translator", return_value=translator),
            mock.patch.object(trinity_cn, "GameRunner", return_value=game),
            mock.patch.object(trinity_cn.time, "sleep"),
            mock.patch("builtins.input", side_effect=user_inputs),
            redirect_stdout(io.StringIO()),
        ):
            trinity_cn.main()

        self.assertEqual(
            game.commands,
            ["take white umbrella", "inventory", "save", "restore"],
        )
        self.assertEqual(game.filename_replies, ["slot1.sav", "slot1.sav"])
        self.assertTrue(game.killed)


if __name__ == "__main__":
    unittest.main()
