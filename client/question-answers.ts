import type { z } from "zod";
import type { questionSchema } from "../shared/execution.ts";

export function buildQuestionAnswers(
  questions: z.infer<typeof questionSchema>[],
  selected: Record<string, string[]>,
  custom: Record<string, string>,
) {
  return Object.fromEntries(
    questions.map((question) => {
      const labels = selected[question.header] ?? [];
      const text = custom[question.header]?.trim() ?? "";
      return [
        question.header,
        question.multiSelect
          ? [...labels, ...(text ? [text] : [])].join(", ")
          : text || labels.join(", "),
      ];
    }),
  );
}
