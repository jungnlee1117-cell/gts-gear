/** additional_payment_requests 표시 헬퍼 */

export function getRequestKindMeta(req) {
  const kind = req?.request_kind
    || (req?.expense_type ? "expense" : null)
    || "allowance";
  if (kind === "expense" || req?.expense_type) {
    return {
      kind: "expense",
      label: "비용",
      typeLabel: req.expense_type || req.reason || "비용",
    };
  }
  if (kind === "lesson") {
    return { kind: "lesson", label: "수업", typeLabel: req.reason || "수업" };
  }
  return {
    kind: "allowance",
    label: "추가수당",
    typeLabel: req.reason || "추가수당",
  };
}

export function summarizePaymentRequests(requests = []) {
  let pendingExpense = 0;
  let pendingAllowance = 0;
  let pendingTotal = 0;
  for (const req of requests) {
    if (req?.status !== "pending") continue;
    pendingTotal += 1;
    const kind = getRequestKindMeta(req).kind;
    if (kind === "expense") pendingExpense += 1;
    else pendingAllowance += 1;
  }
  return {
    total: requests.length,
    pendingTotal,
    pendingExpense,
    pendingAllowance,
  };
}
