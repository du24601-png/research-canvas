#!/usr/bin/env python3
"""AKShare sidecar — JSON line stdin/stdout protocol."""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timedelta
from typing import Any

# Broken local proxy vars often break TLS to East Money / Sina endpoints.
import os

for _key in (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
):
    os.environ.pop(_key, None)
os.environ["NO_PROXY"] = "*"


def _read_request() -> dict[str, Any] | None:
    line = sys.stdin.readline()
    if not line.strip():
        return None
    return json.loads(line)


def _respond(obj: dict[str, Any]) -> None:
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    try:
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
    except TypeError:
        pass
    if hasattr(value, "isoformat"):
        return str(value)[:10]
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def _row_dict(row: Any, columns: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for col in columns:
        out[col] = _json_value(row[col])
    return out


def _to_em_symbol(code: str) -> str:
    c = str(code or "").strip().upper()
    if not c:
        return c
    if "." in c:
        return c
    digits = c.split(".")[0]
    if digits.startswith(("6", "9")):
        return f"{digits}.SH"
    return f"{digits}.SZ"


def _six_digit(code: str) -> str:
    c = str(code or "").strip().upper()
    if "." in c:
        c = c.split(".")[0]
    return c[:6]


def _report_month(report_date: Any) -> str:
    text = str(report_date or "")
    if len(text) >= 7:
        return text[5:7]
    return ""


def _filter_financial_rows(rows: list[dict[str, Any]], report_type: str) -> list[dict[str, Any]]:
    rt = str(report_type or "annual").lower()
    if rt in ("quarter", "quarterly"):
        return rows
    out: list[dict[str, Any]] = []
    for row in rows:
        month = _report_month(row.get("REPORT_DATE"))
        if month == "12":
            out.append(row)
    return out


def _ping() -> dict[str, Any]:
    import akshare as ak

    return {"ok": True, "message": f"AKShare {ak.__version__}"}


def _financials(args: dict[str, Any]) -> dict[str, Any]:
    import akshare as ak

    symbol = _to_em_symbol(str(args.get("code", "")))
    if not symbol:
        return {"ok": False, "error": "missing code"}
    report_type = str(args.get("reportType", "annual"))
    df = ak.stock_financial_analysis_indicator_em(symbol=symbol, indicator="按报告期")
    if df is None or df.empty:
        return {"ok": True, "rows": []}
    columns = [str(c) for c in df.columns]
    rows = [_row_dict(row, columns) for _, row in df.iterrows()]
    rows = _filter_financial_rows(rows, report_type)
    return {"ok": True, "rows": rows}


def _kline(args: dict[str, Any]) -> dict[str, Any]:
    import akshare as ak

    symbol = _six_digit(str(args.get("code", "")))
    if not symbol:
        return {"ok": False, "error": "missing code"}
    period_raw = str(args.get("period", "daily")).lower()
    period_map = {
        "daily": "daily",
        "1d": "daily",
        "day": "daily",
        "weekly": "weekly",
        "1w": "weekly",
        "week": "weekly",
        "monthly": "monthly",
        "1m": "monthly",
        "month": "monthly",
    }
    period = period_map.get(period_raw, "daily")
    start = str(args.get("start", "")).replace("-", "")[:8]
    end = str(args.get("end", "")).replace("-", "")[:8]
    if not end:
        end = datetime.now().strftime("%Y%m%d")
    if not start:
        start = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
    df = ak.stock_zh_a_hist(
        symbol=symbol,
        period=period,
        start_date=start,
        end_date=end,
        adjust="qfq",
    )
    if df is None or df.empty:
        return {"ok": True, "rows": []}
    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        rows.append(
            {
                "date": str(row.iloc[0])[:10],
                "open": _json_value(row.iloc[2]),
                "close": _json_value(row.iloc[3]),
                "high": _json_value(row.iloc[4]),
                "low": _json_value(row.iloc[5]),
                "volume": _json_value(row.iloc[6]),
                "amount": _json_value(row.iloc[7]),
                "changePct": _json_value(row.iloc[9]) if len(row) > 9 else None,
                "turnoverRate": _json_value(row.iloc[11]) if len(row) > 11 else None,
            }
        )
    return {"ok": True, "rows": rows}


def _dispatch(req: dict[str, Any]) -> dict[str, Any]:
    op = str(req.get("op", "")).strip()
    args = req.get("args") if isinstance(req.get("args"), dict) else {}
    if op == "ping":
        return _ping()
    if op == "financials":
        return _financials(args)
    if op == "kline":
        return _kline(args)
    return {"ok": False, "error": f"unknown op: {op}"}


def main() -> int:
    try:
        req = _read_request()
        if not req:
            _respond({"ok": False, "error": "empty request"})
            return 1
        result = _dispatch(req)
        _respond(result)
        return 0 if result.get("ok") else 1
    except Exception as exc:
        _respond({"ok": False, "error": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
