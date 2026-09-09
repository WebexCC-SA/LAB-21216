#!/usr/bin/env python3
from __future__ import annotations

import json
import unittest
from http import HTTPStatus
from unittest.mock import patch

import image_size_editor


class _Headers:
    @staticmethod
    def get_content_type() -> str:
        return "application/json"


class _Response:
    status = HTTPStatus.OK
    headers = _Headers()

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    @staticmethod
    def read(_limit: int) -> bytes:
        return b'{"code":"1234-5678-9012-3456"}'


class WebexProxyTests(unittest.TestCase):
    token = "abcdefghijklmnopqrstuvwxyz0123456789"

    def test_activation_rebuilds_allow_listed_body(self) -> None:
        payload = {
            "bearer_token": self.token,
            "person_id": "person-id",
            "model": "Cisco 9871",
            "ignored": "not forwarded",
        }
        with patch.object(
            image_size_editor, "urlopen", return_value=_Response()
        ) as mocked_urlopen:
            status, result = image_size_editor.proxy_webex_request(
                "activation", payload
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(result, {"code": "1234-5678-9012-3456"})
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.method, "POST")
        self.assertEqual(
            json.loads(request.data),
            {
                "personId": "person-id",
                "model": "Cisco 9871",
            },
        )

    def test_rejects_unapproved_model(self) -> None:
        with self.assertRaisesRegex(ValueError, "phone model"):
            image_size_editor.proxy_webex_request(
                "activation",
                {
                    "bearer_token": self.token,
                    "person_id": "person-id",
                    "model": "Unsupported model",
                },
            )


if __name__ == "__main__":
    unittest.main()
