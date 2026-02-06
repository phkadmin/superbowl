#!/usr/bin/env python3
import json
import os
import random
import sqlite3
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT_DIR, "static")
DB_PATH = os.path.join(ROOT_DIR, "data", "superbowl.db")
ADMIN_PASSWORD = "SOUP"
SQUARES_COST = 4
SQUARES_MAX_PER_USER = 5

QUESTIONS = [
    {
        "id": 1,
        "text": "How long will Charlie Puth's rendition of the National Anthem last from first note to last?",
        "type": "numeric",
        "cost": 1,
        "min": 0,
        "max": 500,
        "suffix": "seconds",
    },
    {"id": 2, "text": "Which team will win the coin toss?", "type": "radio", "cost": 1, "options": ["Seahawks", "Patriots"]},
    {"id": 3, "text": "Which team will make the first touchdown?", "type": "radio", "cost": 2, "options": ["Seahawks", "Patriots"]},
    {"id": 4, "text": "Which team will make the first field goal?", "type": "radio", "cost": 2, "options": ["Seahawks", "Patriots"]},
    {
        "id": 5,
        "text": "What animal will appear first in the advertisements following kickoff?",
        "type": "radio",
        "cost": 1,
        "options": [
            "Dog",
            "Cat",
            "Horse",
            "Lizard",
            "Snake",
            "Lion",
            "Elephant",
            "Monkey/Chimp",
            "Giraffe",
            "Fish",
            "Zebra",
            "Mouse",
            "Duck/Goose",
            "Cow",
            "Bird",
            "Other",
        ],
    },
    {"id": 6, "text": "What will be the first beverage commercial shown following kickoff?", "type": "radio", "cost": 1, "options": ["Budweiser", "Miller", "Corona", "Coors", "Pepsi", "Coke", "Fanta", "Sprite", "Other"]},
    {"id": 7, "text": "What will be the first automobile commercial shown following kickoff?", "type": "radio", "cost": 1, "options": ["Toyota", "Jeep", "GMC", "Ford", "Hyundai", "Honda", "Kia", "BMW", "Mercedes", "VW", "Volvo", "Tesla", "Chevy", "Other"]},
    {"id": 8, "text": "What will be the first AI commercial shown following kickoff?", "type": "radio", "cost": 1, "options": ["OpenAI/ChatGPT", "Anthropic/Claude", "Google/Gemini", "None", "Other"]},
    {"id": 9, "text": "What will the Patriots' score be at halftime?", "type": "numeric", "cost": 2, "min": 1, "max": 100},
    {"id": 10, "text": "What will the Seahawks' score be at halftime?", "type": "numeric", "cost": 2, "min": 1, "max": 100},
    {"id": 11, "text": "Will Bad Bunny open with Tití Me Preguntó?", "type": "radio", "cost": 1, "options": ["Yes", "No"]},
    {"id": 12, "text": "Will Bad Bunny switch to English at any point during the halftime show?", "type": "radio", "cost": 1, "options": ["Yes", "No"]},
    {"id": 13, "text": "Will Bad Bunny have a natively English-speaking guest appear in his show?", "type": "radio", "cost": 1, "options": ["Yes", "No", "No Guest"]},
    {"id": 14, "text": "Will Bad Bunny make a political statement about ICE during the halftime show?", "type": "radio", "cost": 1, "options": ["Yes", "No"]},
    {"id": 15, "text": "Will Bad Bunny's performance feature pyrotechnics?", "type": "radio", "cost": 1, "options": ["Yes", "No"]},
    {"id": 16, "text": "Which insurance company will have the first commercial after the halftime show?", "type": "radio", "cost": 1, "options": ["Allstate", "Geico", "Progressive", "Farmers", "Liberty Mutual", "USAA", "Other"]},
    {"id": 17, "text": "The first commercial featuring a child after the halftime show will be for a:", "type": "radio", "cost": 1, "options": ["Food", "Beverage", "Insurance", "Car", "Software", "Phone/Internet Service", "Body/Beauty Product", "Movie/TV Show", "Restaurant", "Other"]},
    {"id": 18, "text": "Who will be leading at the 2-minute warning of Q4?", "type": "radio", "cost": 2, "options": ["Seahawks", "Patriots"]},
    {"id": 19, "text": "What will the Patriots' final score be?", "type": "numeric", "cost": 2, "min": 1, "max": 100},
    {"id": 20, "text": "What will the Seahawks' final score be?", "type": "numeric", "cost": 2, "min": 1, "max": 100},
    {"id": 21, "text": "Who will win the game?", "type": "radio", "cost": 2, "options": ["Seahawks", "Patriots"]},
    {"id": 22, "text": "What color Gatorade will the winning team dump on the coach?", "type": "radio", "cost": 1, "options": ["Blue", "Green", "Red", "Orange", "Yellow", "Purple", "None"]},
    {"id": 23, "text": "Who will the winning QB thank first after the game?", "type": "radio", "cost": 1, "options": ["Their wife/kids", "Their parents", "God", "Their team", "Their coach", "The fans"]},
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def send_json(handler, payload, status=200):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def parse_json(handler):
    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        content_length = 0
    raw = handler.rfile.read(content_length) if content_length else b"{}"
    return json.loads(raw.decode("utf-8"))


def initials(name):
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def color_for_name(name):
    palette = ["#ff007a", "#bafd6e", "#3c2e55", "#ff66b4", "#d3ff9d", "#5a4a7d", "#f95db2", "#89d160"]
    value = sum((i + 1) * ord(c) for i, c in enumerate(name.lower()))
    return palette[value % len(palette)]


def digits_only(value):
    return "".join(c for c in str(value or "") if c.isdigit())


def ensure_square_game(conn):
    row = conn.execute("SELECT id FROM square_game WHERE id = 1").fetchone()
    if row:
        return
    row_digits = list(range(10))
    col_digits = list(range(10))
    random.shuffle(row_digits)
    random.shuffle(col_digits)
    conn.execute(
        """
        INSERT INTO square_game(
            id, row_digits, col_digits,
            q1_pat, q1_sea, q2_pat, q2_sea, q3_pat, q3_sea, q4_pat, q4_sea
        ) VALUES (1, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
        """,
        (json.dumps(row_digits), json.dumps(col_digits)),
    )


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            venmo_handle TEXT,
            phone_number TEXT,
            payment_method TEXT NOT NULL,
            total_owed REAL NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer_text TEXT NOT NULL,
            FOREIGN KEY(submission_id) REFERENCES submissions(id)
        );

        CREATE TABLE IF NOT EXISTS correct_answers (
            question_id INTEGER PRIMARY KEY,
            answer_text TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS square_game (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            row_digits TEXT NOT NULL,
            col_digits TEXT NOT NULL,
            q1_pat INTEGER,
            q1_sea INTEGER,
            q2_pat INTEGER,
            q2_sea INTEGER,
            q3_pat INTEGER,
            q3_sea INTEGER,
            q4_pat INTEGER,
            q4_sea INTEGER
        );

        CREATE TABLE IF NOT EXISTS square_selections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id INTEGER NOT NULL,
            row_idx INTEGER NOT NULL,
            col_idx INTEGER NOT NULL,
            FOREIGN KEY(submission_id) REFERENCES submissions(id),
            UNIQUE(row_idx, col_idx)
        );
        """
    )
    ensure_square_game(conn)
    conn.commit()
    conn.close()


def validate_answer(question, answer):
    if answer is None:
        return None
    if isinstance(answer, str):
        answer = answer.strip()
    if answer == "":
        return None

    if question["type"] == "numeric":
        if isinstance(answer, bool):
            raise ValueError("Numeric answer must be an integer")
        if isinstance(answer, str):
            if not answer.isdigit():
                raise ValueError("Numeric answer must be an integer")
            value = int(answer)
        elif isinstance(answer, int):
            value = answer
        else:
            raise ValueError("Numeric answer must be an integer")
        if value < question["min"] or value > question["max"]:
            raise ValueError(f"Answer for Q{question['id']} must be between {question['min']} and {question['max']}")
        return str(value)

    if question["type"] == "radio":
        if not isinstance(answer, str):
            raise ValueError("Multiple choice answer must be text")
        if answer not in question["options"]:
            raise ValueError(f"Invalid option for Q{question['id']}")
        return answer

    raise ValueError("Unsupported question type")


def get_square_board(conn):
    ensure_square_game(conn)
    row = conn.execute("SELECT * FROM square_game WHERE id = 1").fetchone()
    return {
        "rowDigits": json.loads(row["row_digits"]),
        "colDigits": json.loads(row["col_digits"]),
        "scores": {
            "q1": {"patriots": row["q1_pat"], "seahawks": row["q1_sea"]},
            "q2": {"patriots": row["q2_pat"], "seahawks": row["q2_sea"]},
            "q3": {"patriots": row["q3_pat"], "seahawks": row["q3_sea"]},
            "q4": {"patriots": row["q4_pat"], "seahawks": row["q4_sea"]},
        },
    }


def list_square_selections(conn, with_people=False):
    if with_people:
        rows = conn.execute(
            """
            SELECT sq.row_idx, sq.col_idx, s.full_name
            FROM square_selections sq
            JOIN submissions s ON s.id = sq.submission_id
            """
        ).fetchall()
        return [
            {
                "row": r["row_idx"],
                "col": r["col_idx"],
                "name": r["full_name"],
                "initials": initials(r["full_name"]),
                "color": color_for_name(r["full_name"]),
            }
            for r in rows
        ]

    rows = conn.execute("SELECT row_idx, col_idx FROM square_selections").fetchall()
    return [{"row": r["row_idx"], "col": r["col_idx"]} for r in rows]


def build_squares_public(conn):
    return {
        "cost": SQUARES_COST,
        "maxPerUser": SQUARES_MAX_PER_USER,
        "taken": list_square_selections(conn, with_people=True),
    }


def build_squares_revealed(conn):
    board = get_square_board(conn)
    return {
        "cost": SQUARES_COST,
        "rowDigits": board["rowDigits"],
        "colDigits": board["colDigits"],
        "taken": list_square_selections(conn, with_people=True),
    }


def build_submission_view(conn, last4):
    rows = conn.execute(
        "SELECT id, full_name, venmo_handle, phone_number, created_at FROM submissions ORDER BY id DESC"
    ).fetchall()
    target = str(last4 or "").strip()
    submission = None
    for row in rows:
        if digits_only(row["phone_number"]).endswith(target):
            submission = row
            break
    if submission is None:
        return None

    answers = conn.execute("SELECT question_id, answer_text FROM answers WHERE submission_id = ?", (submission["id"],)).fetchall()
    squares = conn.execute("SELECT row_idx, col_idx FROM square_selections WHERE submission_id = ?", (submission["id"],)).fetchall()

    return {
        "submissionId": submission["id"],
        "fullName": submission["full_name"],
        "venmoHandle": submission["venmo_handle"] or "",
        "phoneNumber": submission["phone_number"] or "",
        "createdAt": submission["created_at"],
        "answers": {str(r["question_id"]): r["answer_text"] for r in answers},
        "squares": [{"row": r["row_idx"], "col": r["col_idx"]} for r in squares],
    }


def build_results(conn):
    rows = conn.execute(
        """
        SELECT a.question_id, a.answer_text, s.full_name
        FROM answers a
        JOIN submissions s ON s.id = a.submission_id
        """
    ).fetchall()
    grouped = {}
    for row in rows:
        grouped.setdefault(row["question_id"], []).append(dict(row))

    question_summaries = []
    for q in QUESTIONS:
        q_rows = grouped.get(q["id"], [])
        if q["type"] == "numeric":
            points = []
            values = []
            for r in q_rows:
                try:
                    val = int(r["answer_text"])
                except ValueError:
                    continue
                values.append(val)
                points.append(
                    {
                        "name": r["full_name"],
                        "initials": initials(r["full_name"]),
                        "color": color_for_name(r["full_name"]),
                        "value": val,
                    }
                )
            highest = max(values) if values else 1
            question_summaries.append(
                {
                    "id": q["id"],
                    "text": q["text"],
                    "type": "numeric",
                    "cost": q["cost"],
                    "scaleMax": max(5, int(round(highest * 1.05))),
                    "points": points,
                }
            )
        else:
            option_map = {opt: [] for opt in q["options"]}
            for r in q_rows:
                if r["answer_text"] in option_map:
                    option_map[r["answer_text"]].append(
                        {
                            "name": r["full_name"],
                            "initials": initials(r["full_name"]),
                            "color": color_for_name(r["full_name"]),
                        }
                    )
            bars = [{"option": opt, "count": len(option_map[opt]), "participants": option_map[opt]} for opt in q["options"]]
            question_summaries.append(
                {"id": q["id"], "text": q["text"], "type": "radio", "cost": q["cost"], "bars": bars}
            )

    total_submissions = conn.execute("SELECT COUNT(*) AS c FROM submissions").fetchone()["c"]
    return {"questions": question_summaries, "totalSubmissions": total_submissions}


def calculate_squares_winners(conn):
    board = get_square_board(conn)
    selections = list_square_selections(conn, with_people=True)
    pot = SQUARES_COST * len(selections)
    quarter_share = round(pot / 4, 2)

    sel_map = {(s["row"], s["col"]): s for s in selections}

    payouts = {}
    quarter_results = {}
    for quarter_key in ["q1", "q2", "q3", "q4"]:
        p_score = board["scores"][quarter_key]["patriots"]
        s_score = board["scores"][quarter_key]["seahawks"]
        result = {
            "patriots": p_score,
            "seahawks": s_score,
            "winner": None,
            "cell": None,
            "amount": quarter_share,
        }

        if p_score is not None and s_score is not None:
            p_digit = p_score % 10
            s_digit = s_score % 10
            try:
                row_idx = board["rowDigits"].index(s_digit)
                col_idx = board["colDigits"].index(p_digit)
                result["cell"] = {"row": row_idx, "col": col_idx, "seahawksDigit": s_digit, "patriotsDigit": p_digit}
                winner = sel_map.get((row_idx, col_idx))
                if winner:
                    result["winner"] = winner
                    payouts[winner["name"]] = payouts.get(winner["name"], 0) + quarter_share
            except ValueError:
                pass

        quarter_results[quarter_key] = result

    return {
        "pot": round(pot, 2),
        "quarterShare": quarter_share,
        "quarters": quarter_results,
        "payoutByName": payouts,
    }


def build_admin_payload(conn):
    correct_rows = conn.execute("SELECT question_id, answer_text FROM correct_answers").fetchall()
    correct_map = {r["question_id"]: r["answer_text"] for r in correct_rows}

    payout_by_name = {}
    question_breakdown = []

    for q in QUESTIONS:
        c_answer = correct_map.get(q["id"])
        rows = conn.execute(
            """
            SELECT s.full_name, a.answer_text
            FROM answers a
            JOIN submissions s ON s.id = a.submission_id
            WHERE a.question_id = ?
            """,
            (q["id"],),
        ).fetchall()

        collected = q["cost"] * len(rows)
        winners = []
        if c_answer and rows:
            if q["type"] == "numeric":
                try:
                    target = int(c_answer)
                    dist = []
                    for row in rows:
                        try:
                            dist.append((abs(int(row["answer_text"]) - target), row["full_name"]))
                        except ValueError:
                            continue
                    if dist:
                        best = min(d[0] for d in dist)
                        winners = [n for d, n in dist if d == best]
                except ValueError:
                    winners = []
            else:
                winners = [row["full_name"] for row in rows if row["answer_text"] == c_answer]

        unique_winners = sorted(set(winners))
        split = (collected / len(unique_winners)) if unique_winners else 0
        for winner in unique_winners:
            payout_by_name[winner] = payout_by_name.get(winner, 0) + split

        question_breakdown.append(
            {
                "questionId": q["id"],
                "text": q["text"],
                "collected": collected,
                "correctAnswer": c_answer,
                "winners": unique_winners,
                "splitAmount": round(split, 2),
            }
        )

    squares = build_squares_revealed(conn)
    squares_calc = calculate_squares_winners(conn)
    for name, amount in squares_calc["payoutByName"].items():
        payout_by_name[name] = payout_by_name.get(name, 0) + amount

    paid_rows = conn.execute("SELECT full_name, SUM(total_owed) AS total_paid FROM submissions GROUP BY full_name").fetchall()
    paid_map = {r["full_name"]: float(r["total_paid"] or 0) for r in paid_rows}

    everyone = sorted(set(list(payout_by_name.keys()) + list(paid_map.keys())))
    by_person = []
    for person in everyone:
        paid_in = paid_map.get(person, 0)
        owed = float(payout_by_name.get(person, 0))
        by_person.append(
            {
                "name": person,
                "initials": initials(person),
                "color": color_for_name(person),
                "paidIn": round(paid_in, 2),
                "owed": round(owed, 2),
                "net": round(owed - paid_in, 2),
            }
        )

    total_collected = round(sum(item["collected"] for item in question_breakdown) + squares_calc["pot"], 2)
    total_owed = round(sum(item["owed"] for item in by_person), 2)

    return {
        "correctAnswers": correct_map,
        "byPerson": by_person,
        "questionBreakdown": question_breakdown,
        "totalCollected": total_collected,
        "totalOwed": total_owed,
        "houseRemainder": round(total_collected - total_owed, 2),
        "squares": {
            "board": squares,
            "scores": get_square_board(conn)["scores"],
            "pot": squares_calc["pot"],
            "quarterShare": squares_calc["quarterShare"],
            "quarters": squares_calc["quarters"],
        },
    }


def parse_square_selections(raw):
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("Invalid square selections payload.")

    parsed = []
    seen = set()
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("Invalid square selections payload.")
        row = item.get("row")
        col = item.get("col")
        if not isinstance(row, int) or not isinstance(col, int):
            raise ValueError("Square coordinates must be integers.")
        if row < 0 or row > 9 or col < 0 or col > 9:
            raise ValueError("Square coordinates must be from 0 to 9.")
        key = (row, col)
        if key in seen:
            continue
        seen.add(key)
        parsed.append({"row": row, "col": col})

    if len(parsed) > SQUARES_MAX_PER_USER:
        raise ValueError(f"You can select up to {SQUARES_MAX_PER_USER} squares.")
    return parsed


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parsed = urlparse(path)
        cleaned = parsed.path
        if cleaned == "/":
            cleaned = "/index.html"
        if cleaned.startswith("/api/"):
            return cleaned
        return os.path.join(STATIC_DIR, cleaned.lstrip("/"))

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/questions":
            send_json(self, {"questions": QUESTIONS})
            return

        if parsed.path == "/api/results":
            conn = get_db()
            payload = build_results(conn)
            conn.close()
            send_json(self, payload)
            return

        if parsed.path == "/api/squares/public":
            conn = get_db()
            payload = build_squares_public(conn)
            conn.close()
            send_json(self, payload)
            return

        if parsed.path == "/api/squares/revealed":
            conn = get_db()
            payload = build_squares_revealed(conn)
            conn.close()
            send_json(self, payload)
            return

        if parsed.path == "/api/admin/state":
            if self.headers.get("X-Admin-Password", "") != ADMIN_PASSWORD:
                send_json(self, {"error": "Unauthorized"}, 401)
                return
            conn = get_db()
            payload = build_admin_payload(conn)
            conn.close()
            send_json(self, payload)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/admin/login":
            data = parse_json(self)
            ok = data.get("password") == ADMIN_PASSWORD
            send_json(self, {"ok": ok}, 200 if ok else 401)
            return

        if parsed.path == "/api/admin/correct-answers":
            if self.headers.get("X-Admin-Password", "") != ADMIN_PASSWORD:
                send_json(self, {"error": "Unauthorized"}, 401)
                return
            data = parse_json(self)
            answers = data.get("answers", {})
            conn = get_db()
            for q in QUESTIONS:
                raw = answers.get(str(q["id"]))
                if raw is None or str(raw).strip() == "":
                    conn.execute("DELETE FROM correct_answers WHERE question_id = ?", (q["id"],))
                    continue
                try:
                    normalized = validate_answer(q, raw)
                except ValueError as err:
                    conn.close()
                    send_json(self, {"error": str(err)}, 400)
                    return
                conn.execute(
                    """
                    INSERT INTO correct_answers(question_id, answer_text)
                    VALUES(?, ?)
                    ON CONFLICT(question_id) DO UPDATE SET answer_text = excluded.answer_text
                    """,
                    (q["id"], normalized),
                )
            conn.commit()
            payload = build_admin_payload(conn)
            conn.close()
            send_json(self, payload)
            return

        if parsed.path == "/api/admin/squares-scores":
            if self.headers.get("X-Admin-Password", "") != ADMIN_PASSWORD:
                send_json(self, {"error": "Unauthorized"}, 401)
                return
            data = parse_json(self)
            scores = data.get("scores", {})
            values = {}
            for quarter in ["q1", "q2", "q3", "q4"]:
                q_scores = scores.get(quarter, {})
                for team in ["patriots", "seahawks"]:
                    key = f"{quarter}_{team[:3]}" if team == "patriots" else f"{quarter}_sea"
                    raw = q_scores.get(team)
                    if raw is None or raw == "":
                        values[key] = None
                        continue
                    if not isinstance(raw, int) or raw < 0 or raw > 200:
                        send_json(self, {"error": f"Invalid score for {quarter} {team}."}, 400)
                        return
                    values[key] = raw

            conn = get_db()
            conn.execute(
                """
                UPDATE square_game SET
                    q1_pat = ?, q1_sea = ?,
                    q2_pat = ?, q2_sea = ?,
                    q3_pat = ?, q3_sea = ?,
                    q4_pat = ?, q4_sea = ?
                WHERE id = 1
                """,
                (
                    values["q1_pat"], values["q1_sea"],
                    values["q2_pat"], values["q2_sea"],
                    values["q3_pat"], values["q3_sea"],
                    values["q4_pat"], values["q4_sea"],
                ),
            )
            conn.commit()
            payload = build_admin_payload(conn)
            conn.close()
            send_json(self, payload)
            return

        if parsed.path == "/api/view-guesses":
            data = parse_json(self)
            last4 = digits_only(data.get("last4", ""))
            if len(last4) != 4:
                send_json(self, {"error": "Please provide exactly 4 digits."}, 400)
                return
            conn = get_db()
            payload = build_submission_view(conn, last4)
            conn.close()
            if payload is None:
                send_json(self, {"error": "No submission found for that phone ending."}, 404)
                return
            send_json(self, {"ok": True, "submission": payload})
            return

        if parsed.path == "/api/submissions":
            data = parse_json(self)
            full_name = str(data.get("fullName", "")).strip()
            venmo_handle = str(data.get("venmoHandle", "")).strip()
            phone_number = str(data.get("phoneNumber", "")).strip()
            payment_method = str(data.get("paymentMethod", "")).strip().lower()
            answers = data.get("answers", {})

            if not full_name:
                send_json(self, {"error": "Full name is required."}, 400)
                return
            if payment_method not in {"cash", "venmo"}:
                send_json(self, {"error": "Invalid payment method."}, 400)
                return
            if not isinstance(answers, dict):
                send_json(self, {"error": "Answers payload is invalid."}, 400)
                return

            try:
                squares = parse_square_selections(data.get("squareSelections", []))
            except ValueError as err:
                send_json(self, {"error": str(err)}, 400)
                return

            normalized_answers = []
            total_owed = 0
            for q in QUESTIONS:
                raw = answers.get(str(q["id"]))
                try:
                    normalized = validate_answer(q, raw)
                except ValueError as err:
                    send_json(self, {"error": str(err)}, 400)
                    return
                if normalized is None:
                    continue
                normalized_answers.append((q["id"], normalized))
                total_owed += q["cost"]

            total_owed += len(squares) * SQUARES_COST

            conn = get_db()
            now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
            try:
                conn.execute("BEGIN IMMEDIATE")

                for sq in squares:
                    taken = conn.execute(
                        "SELECT 1 FROM square_selections WHERE row_idx = ? AND col_idx = ?",
                        (sq["row"], sq["col"]),
                    ).fetchone()
                    if taken:
                        conn.execute("ROLLBACK")
                        send_json(self, {"error": f"Square {sq['row'] + 1},{sq['col'] + 1} was just taken. Please pick another."}, 409)
                        conn.close()
                        return

                cur = conn.execute(
                    """
                    INSERT INTO submissions(full_name, venmo_handle, phone_number, payment_method, total_owed, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (full_name, venmo_handle, phone_number, payment_method, total_owed, now),
                )
                submission_id = cur.lastrowid

                conn.executemany(
                    "INSERT INTO answers(submission_id, question_id, answer_text) VALUES (?, ?, ?)",
                    [(submission_id, qid, ans) for qid, ans in normalized_answers],
                )

                conn.executemany(
                    "INSERT INTO square_selections(submission_id, row_idx, col_idx) VALUES (?, ?, ?)",
                    [(submission_id, sq["row"], sq["col"]) for sq in squares],
                )

                conn.commit()
            except sqlite3.IntegrityError:
                conn.rollback()
                conn.close()
                send_json(self, {"error": "One or more selected squares were unavailable."}, 409)
                return

            payload = {
                "ok": True,
                "submissionId": submission_id,
                "answeredCount": len(normalized_answers),
                "squareCount": len(squares),
                "totalOwed": total_owed,
            }
            conn.close()
            send_json(self, payload)
            return

        send_json(self, {"error": "Not found"}, 404)


def run_server(host="0.0.0.0", port=8000):
    init_db()
    server = HTTPServer((host, port), Handler)
    print(f"Serving on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
