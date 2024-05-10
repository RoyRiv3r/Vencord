/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  addPreEditListener,
  addPreSendListener,
  MessageObject,
  removePreEditListener,
  removePreSendListener,
} from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { DeleteIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { useForceUpdater } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { DataStore } from "@api/index";
import { Button, Forms, React, TextInput, useState } from "@webpack/common";

const logger = new Logger("SocialMediaLinkConverter");

const settings = definePluginSettings({
  convertTwitter: {
    description: "Convert Twitter|X links to fxtwitter",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertTikTok: {
    description: "Convert TikTok links to vxtiktok",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertInstagram: {
    description: "Convert Instagram links to ddinstagram",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertBsky: {
    description: "Convert Bsky links to bsyy",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertThreads: {
    description: "Convert Threads links to vxthreads",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertReddit: {
    description: "Convert Reddit links to rxddit",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertPixiv: {
    description: "Convert Pixiv links to phixiv",
    type: OptionType.BOOLEAN,
    default: true,
  },
  convertDeviantArt: {
    description: "Convert DeviantArt links fxdeviantart",
    type: OptionType.BOOLEAN,
    default: true,
  },
  replace: {
    type: OptionType.COMPONENT,
    description: "",
    component: TextReplaceSettings,
  },
});

const conversionRules = [
  {
    id: "convertTwitter",
    regex: /https:\/\/(twitter\.com|x\.com)\//g,
    replacement: "https://fxtwitter.com/",
  },
  {
    id: "convertTikTok",
    regex: /https:\/\/www\.tiktok\.com\//g,
    replacement: "https://www.vxtiktok.com/",
  },
  {
    id: "convertInstagram",
    regex: /https:\/\/www\.instagram\.com\//g,
    replacement: "https://www.ddinstagram.com/",
  },
  {
    id: "convertBsky",
    regex: /https:\/\/bsky\.app\//g,
    replacement: "https://bsyy.app/",
  },
  {
    id: "convertThreads",
    regex: /https:\/\/(www\.)?threads\.net\//g,
    replacement: "https://www.vxthreads.net/",
  },
  {
    id: "convertReddit",
    regex: /https:\/\/(www\.|new\.)?reddit\.com\//g,
    replacement: "https://www.rxddit.com/",
  },
  {
    id: "convertPixiv",
    regex: /https:\/\/(www\.)?pixiv.net\//g,
    replacement: "https://phixiv.net/",
  },
  {
    id: "convertDeviantArt",
    regex: /https:\/\/(www\.)?deviantart.com\//g,
    replacement: "https://www.fxdeviantart.com/",
  },
];

function replacer(match: string) {
  for (const rule of conversionRules) {
    if (settings.store[rule.id] && rule.regex.test(match)) {
      return match.replace(rule.regex, rule.replacement);
    }
  }
  return match;
}

function onSend(msg: MessageObject) {
  try {
    if (msg.content.match(/http(s)?:\/\//)) {
      msg.content = msg.content.replace(
        /(https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s])/g,
        replacer
      );
    }
  } catch (error) {
    logger.error("Error converting social media links:", error);
  }
}

const STRING_RULES_KEY = "TextReplace_rulesString";
const REGEX_RULES_KEY = "TextReplace_rulesRegex";

type Rule = Record<"find" | "replace" | "onlyIfIncludes", string>;

const makeEmptyRule = (): Rule => ({
  find: "",
  replace: "",
  onlyIfIncludes: "",
});

const makeEmptyRuleArray = () => [makeEmptyRule()];

let stringRules = makeEmptyRuleArray();
let regexRules = makeEmptyRuleArray();

function stringToRegex(str: string) {
  const match = str.match(/^(\/)?(.+?)(?:\/([gimsuy]*))?$/);
  return match
    ? new RegExp(
        match[2],
        match[3]
          ?.split("")
          .filter((char, pos, flagArr) => flagArr.indexOf(char) === pos)
          .join("") ?? "g"
      )
    : new RegExp(str);
}

function renderFindError(find: string) {
  try {
    stringToRegex(find);
    return null;
  } catch (error) {
    return <span style={{ color: "var(--text-danger)" }}>{String(error)}</span>;
  }
}

function Input({
  initialValue,
  onChange,
  placeholder,
}: {
  placeholder: string;
  initialValue: string;
  onChange(value: string): void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChange={setValue}
      spellCheck={false}
      onBlur={() => value !== initialValue && onChange(value)}
    />
  );
}

function TextReplace({
  title,
  rulesArray,
  rulesKey,
  update,
}: {
  title: string;
  rulesArray: Rule[];
  rulesKey: string;
  update: () => void;
}) {
  const isRegexRules = title === "Using Regex";

  async function onClickRemove(index: number) {
    if (index === rulesArray.length - 1) return;
    rulesArray.splice(index, 1);

    try {
      await DataStore.set(rulesKey, rulesArray);
      update();
    } catch (error) {
      logger.error(`Error removing rule at index ${index}:`, error);
    }
  }

  async function onChange(value: string, index: number, key: keyof Rule) {
    if (index === rulesArray.length - 1) rulesArray.push(makeEmptyRule());

    rulesArray[index][key] = value;

    if (
      rulesArray[index].find === "" &&
      rulesArray[index].replace === "" &&
      rulesArray[index].onlyIfIncludes === "" &&
      index !== rulesArray.length - 1
    ) {
      rulesArray.splice(index, 1);
    }

    try {
      await DataStore.set(rulesKey, rulesArray);
      update();
    } catch (error) {
      logger.error(`Error updating rule at index ${index}:`, error);
    }
  }

  return (
    <>
      <Forms.FormTitle tag="h4">{title}</Forms.FormTitle>
      <Flex flexDirection="column" style={{ gap: "0.5em" }}>
        {rulesArray.map((rule, index) => (
          <React.Fragment key={`${rule.find}-${index}`}>
            <Flex flexDirection="row" style={{ gap: 0 }}>
              <Flex flexDirection="row" style={{ flexGrow: 1, gap: "0.5em" }}>
                <Input
                  placeholder="Find"
                  initialValue={rule.find}
                  onChange={(value) => onChange(value, index, "find")}
                />
                <Input
                  placeholder="Replace"
                  initialValue={rule.replace}
                  onChange={(value) => onChange(value, index, "replace")}
                />
                <Input
                  placeholder="Only if includes"
                  initialValue={rule.onlyIfIncludes}
                  onChange={(value) => onChange(value, index, "onlyIfIncludes")}
                />
              </Flex>
              <Button
                size={Button.Sizes.MIN}
                onClick={() => onClickRemove(index)}
                style={{
                  background: "none",
                  color: "var(--status-danger)",
                  ...(index === rulesArray.length - 1
                    ? {
                        visibility: "hidden",
                        pointerEvents: "none",
                      }
                    : {}),
                }}
              >
                <DeleteIcon />
              </Button>
            </Flex>
            {isRegexRules && renderFindError(rule.find)}
          </React.Fragment>
        ))}
      </Flex>
    </>
  );
}

function TextReplaceTesting() {
  const [value, setValue] = useState("");
  return (
    <>
      <Forms.FormTitle tag="h4">Test Rules</Forms.FormTitle>
      <TextInput placeholder="Type a message" onChange={setValue} />
      <TextInput
        placeholder="Message with rules applied"
        editable={false}
        value={applyRules(value)}
      />
    </>
  );
}

function applyRules(content: string): string {
  if (content.length === 0) return content;

  try {
    if (stringRules) {
      for (const rule of stringRules) {
        if (!rule.find) continue;
        if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes))
          continue;

        content = ` ${content} `
          .replaceAll(rule.find, rule.replace.replaceAll("\\n", "\n"))
          .replace(/^\s|\s$/g, "");
      }
    }

    if (regexRules) {
      for (const rule of regexRules) {
        if (!rule.find) continue;
        if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes))
          continue;

        const regex = stringToRegex(rule.find);
        content = content.replace(regex, rule.replace.replaceAll("\\n", "\n"));
      }
    }
  } catch (error) {
    logger.error("Error applying rules:", error);
  }

  return content.trim();
}

function TextReplaceSettings() {
  const update = useForceUpdater();
  return (
    <>
      <TextReplace
        title="Using String"
        rulesArray={stringRules}
        rulesKey={STRING_RULES_KEY}
        update={update}
      />
      <TextReplace
        title="Using Regex"
        rulesArray={regexRules}
        rulesKey={REGEX_RULES_KEY}
        update={update}
      />
      <TextReplaceTesting />
    </>
  );
}

export default definePlugin({
  name: "SocialMediaLinkConverter",
  description: "Converts social media links based on specified rules",
  authors: [Devs.RoyRiver],
  dependencies: ["MessageEventsAPI"],

  async start() {
    try {
      stringRules =
        (await DataStore.get(STRING_RULES_KEY)) ?? makeEmptyRuleArray();
      regexRules =
        (await DataStore.get(REGEX_RULES_KEY)) ?? makeEmptyRuleArray();
    } catch (error) {
      logger.error("Error loading rules from DataStore:", error);
    }

    this.preSend = addPreSendListener((_, msg) => onSend(msg));
    this.preEdit = addPreEditListener((_cid, _mid, msg) => onSend(msg));
  },

  stop() {
    removePreSendListener(this.preSend);
    removePreEditListener(this.preEdit);
  },

  settings,
});
