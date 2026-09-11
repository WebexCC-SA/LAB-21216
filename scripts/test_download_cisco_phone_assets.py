#!/usr/bin/env python3
from __future__ import annotations

import unittest
from xml.etree import ElementTree

import download_cisco_phone_assets as assets


class CiscoPhoneAssetTests(unittest.TestCase):
    public_base_url = "https://example.test/lab-assets/"

    def test_input_menu_item_is_removed_and_static_url_is_rewritten(
        self,
    ) -> None:
        menu = b"""\
<CiscoIPPhoneMenu>
  <MenuItem>
    <Name>Directory</Name>
    <URL>https://www.cisco.com/c/dam/en/us/td/docs/voice_ip_comm/phv/dxml/CiscoIPPhoneDirectory.xml</URL>
  </MenuItem>
  <MenuItem>
    <Name>Input</Name>
    <URL>https://www.cisco.com/c/dam/en/us/td/docs/voice_ip_comm/phv/dxml/CiscoIPPhoneInput.xml</URL>
  </MenuItem>
  <MenuItem>
    <Name>Update</Name>
    <URL>Softkey:Update</URL>
  </MenuItem>
</CiscoIPPhoneMenu>
"""
        hosted, references, input_removed = assets.transform_xml(
            "menu.xml", menu, self.public_base_url
        )

        self.assertTrue(input_removed)
        self.assertEqual(references, {"CiscoIPPhoneDirectory.xml"})
        self.assertNotIn(b"CiscoIPPhoneInput.xml", hosted)
        self.assertNotIn(b"127.0.0.1", hosted)
        self.assertIn(
            (
                self.public_base_url
                + "CiscoIPPhoneDirectory.xml"
            ).encode("utf-8"),
            hosted,
        )
        self.assertIn(b"Softkey:Update", hosted)

    def test_rejects_reference_outside_approved_cisco_directory(self) -> None:
        with self.assertRaisesRegex(ValueError, "approved source"):
            assets.validated_filename(
                "https://example.test/CiscoIPPhoneDirectory.xml"
            )

    def test_rejects_excessive_xml_depth(self) -> None:
        root = ElementTree.Element("root")
        current = root
        for _ in range(assets.MAX_XML_DEPTH):
            current = ElementTree.SubElement(current, "child")

        with self.assertRaisesRegex(ValueError, "nesting limit"):
            assets.validate_xml_structure(root)

    def test_validates_png_signature_and_content_type(self) -> None:
        assets.validate_png(
            "image.png",
            b"\x89PNG\r\n\x1a\ncontent",
            "image/png",
        )
        with self.assertRaisesRegex(ValueError, "not a valid PNG"):
            assets.validate_png("image.png", b"not-png", "image/png")


if __name__ == "__main__":
    unittest.main()
