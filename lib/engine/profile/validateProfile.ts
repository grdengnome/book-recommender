// Checks a taste profile that arrived over the network before the engine uses it. Anything the
// reader can influence is untrusted: every field is type-checked, unknown slots are refused (a
// typo shouldn't silently drop a reader's answer), text is length-capped (decision 10.5), and
// "avoid" can't be inferred. Returns the profile unchanged when valid, or a list of problems.
import { PROFILE_VERSION, type SlotKey, type TasteProfile } from "@/lib/contracts/tasteProfile";
import { SLOT_SETTINGS } from "./slots";

export const PROFILE_LIMITS = {
  textChars: 200,
  answerChars: 500,
  listItems: 6,
  loved: 3,
  setting: 2,
  answers: 20,
  extras: 10,
};

export type ProfileCheck = { ok: true; profile: TasteProfile } | { ok: false; problems: string[] };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const SOURCES = ["asked", "inferred", "typed"];
const CONFIDENCES = ["partial", "clear"];
const DOORWAYS = ["loved", "feeling", "ingredient", "moment", "surprise"];
const MEDIUMS = ["book", "show", "film", "comic", "game", "other"];
const HOOKS = ["people", "world", "twists", "writing", "feeling"];
const LENGTHS = ["quick", "short", "medium", "long"];

export function validateProfile(input: unknown): ProfileCheck {
  const problems: string[] = [];
  const text = (v: unknown, where: string, max = PROFILE_LIMITS.textChars): boolean => {
    if (typeof v !== "string" || !v.trim()) return problems.push(`${where}: expected text`), false;
    if (v.length > max) return problems.push(`${where}: longer than ${max} characters`), false;
    return true;
  };
  const textList = (v: unknown, where: string, maxItems = PROFILE_LIMITS.listItems): void => {
    if (!Array.isArray(v) || v.length === 0) return void problems.push(`${where}: expected a non-empty list`);
    if (v.length > maxItems) problems.push(`${where}: more than ${maxItems} items`);
    v.forEach((item, i) => text(item, `${where}[${i}]`));
  };
  const oneOf = (v: unknown, options: string[], where: string): void => {
    if (typeof v !== "string" || !options.includes(v)) problems.push(`${where}: expected one of ${options.join(", ")}`);
  };

  if (!isRec(input)) return { ok: false, problems: ["profile: expected an object"] };
  if (input.version !== PROFILE_VERSION) problems.push(`version: expected ${PROFILE_VERSION}`);
  if (input.doorway !== undefined) oneOf(input.doorway, DOORWAYS, "doorway");

  const slots = input.slots;
  if (!isRec(slots)) {
    problems.push("slots: expected an object");
  } else {
    for (const [key, slot] of Object.entries(slots)) {
      const where = `slots.${key}`;
      const setting = SLOT_SETTINGS[key as SlotKey];
      if (!setting) {
        problems.push(`${where}: unknown slot`);
        continue;
      }
      if (!isRec(slot)) {
        problems.push(`${where}: expected { value, source, confidence }`);
        continue;
      }
      oneOf(slot.source, SOURCES, `${where}.source`);
      oneOf(slot.confidence, CONFIDENCES, `${where}.confidence`);
      if (key === "avoid" && slot.source === "inferred") problems.push(`${where}: avoid can't be inferred; only the reader can rule something out`);
      const value = slot.value;
      switch (key as SlotKey) {
        case "loved":
          if (!Array.isArray(value) || value.length === 0) problems.push(`${where}.value: expected a non-empty list`);
          else {
            if (value.length > PROFILE_LIMITS.loved) problems.push(`${where}.value: more than ${PROFILE_LIMITS.loved} items`);
            value.forEach((item, i) => {
              const w = `${where}.value[${i}]`;
              if (!isRec(item)) return void problems.push(`${w}: expected an object`);
              text(item.title, `${w}.title`);
              if (item.creator !== undefined) text(item.creator, `${w}.creator`);
              oneOf(item.medium, MEDIUMS, `${w}.medium`);
              if (item.hooked !== undefined) {
                if (!Array.isArray(item.hooked)) problems.push(`${w}.hooked: expected a list`);
                else item.hooked.forEach((h, j) => oneOf(h, HOOKS, `${w}.hooked[${j}]`));
              }
              if (item.twist !== undefined) text(item.twist, `${w}.twist`);
            });
          }
          break;
        case "mood":
          if (!isRec(value)) problems.push(`${where}.value: expected { words, intensity }`);
          else {
            textList(value.words, `${where}.value.words`);
            if (value.intensity !== undefined && ![1, 2, 3, 4, 5].includes(value.intensity as number)) problems.push(`${where}.value.intensity: expected 1 to 5`);
          }
          break;
        case "ingredients":
        case "avoid":
          textList(value, `${where}.value`);
          break;
        case "setting":
          textList(value, `${where}.value`, PROFILE_LIMITS.setting);
          break;
        case "style":
          if (!Array.isArray(value) || value.length === 0) problems.push(`${where}.value: expected a non-empty list`);
          else value.forEach((v, i) => oneOf(v, Object.keys(setting.values!), `${where}.value[${i}]`));
          break;
        case "moment":
          text(value, `${where}.value`);
          break;
        case "length":
          oneOf(value, LENGTHS, `${where}.value`);
          break;
        default:
          oneOf(value, Object.keys(setting.values ?? {}), `${where}.value`);
      }
    }
  }

  if (!Array.isArray(input.answers)) problems.push("answers: expected a list");
  else {
    if (input.answers.length > PROFILE_LIMITS.answers) problems.push(`answers: more than ${PROFILE_LIMITS.answers}`);
    input.answers.forEach((a, i) => {
      if (!isRec(a)) return void problems.push(`answers[${i}]: expected { question, answer }`);
      text(a.question, `answers[${i}].question`);
      text(a.answer, `answers[${i}].answer`, PROFILE_LIMITS.answerChars);
      if (a.typed !== undefined && typeof a.typed !== "boolean") problems.push(`answers[${i}].typed: expected true or false`);
    });
  }
  if (!Array.isArray(input.extras)) problems.push("extras: expected a list");
  else {
    if (input.extras.length > PROFILE_LIMITS.extras) problems.push(`extras: more than ${PROFILE_LIMITS.extras}`);
    input.extras.forEach((e, i) => text(e, `extras[${i}]`));
  }

  return problems.length ? { ok: false, problems } : { ok: true, profile: input as unknown as TasteProfile };
}
