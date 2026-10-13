import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type InterviewQuestion = {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  problem: string;
};

const questionsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "questions.json",
);

export function loadQuestions() {
  return JSON.parse(readFileSync(questionsPath, "utf8")) as InterviewQuestion[];
}
