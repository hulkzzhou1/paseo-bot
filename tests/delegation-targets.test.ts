import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dispatchedTargets } from "../client/delegations.ts";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";

test("only successful structured same-host Paseo send receipts establish existing target navigation", () => {
  const id = "5f020939-c194-4752-abcf-84405dde7ae0",
    host = "srv_local";
  const receipt = (
    input: unknown,
    output: unknown,
  ): Extract<
    AgentTimelineItem,
    { type: "tool_call"; status: "completed" }
  > => ({
    type: "tool_call",
    callId: "receipt",
    name: "paseo.send_agent_prompt",
    status: "completed",
    error: null,
    detail: { type: "unknown", input, output },
  });
  const output = { structuredContent: { success: true, serverId: host } };
  const valid = receipt({ agentId: id }, output);
  assert.deepEqual(dispatchedTargets([valid, valid], host), [id]);
  const invalid: AgentTimelineItem[] = [
    receipt(
      { agentId: id },
      { structuredContent: { success: false, serverId: host } },
    ),
    receipt({ agentId: id }, { ...output, isError: true }),
    receipt(
      { agentId: id },
      { structuredContent: { success: true, serverId: "srv_foreign" } },
    ),
    receipt({ agentId: id, destinationHostId: "srv_foreign" }, output),
    receipt({ agentId: id }, { structuredContent: { success: true } }),
    receipt({ agentId: "invented" }, output),
    receipt({ agentId: id }, JSON.stringify(output)),
    { type: "assistant_message", text: `Sent to ${id}` },
    { ...valid, status: "failed", error: "not dispatched" },
    { ...valid, status: "running", error: null },
    { ...valid, name: "unrelated.send_agent_prompt" },
  ];
  assert.deepEqual(dispatchedTargets(invalid, host), []);
});
