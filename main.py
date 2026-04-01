from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import random, copy, json
from typing import Optional

app = FastAPI(title="Sudoku API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DIFFICULTY = {"easy": 36, "medium": 46, "hard": 54, "expert": 60}

def is_valid(board, row, col, num):
    if num in board[row]: return False
    if num in [board[r][col] for r in range(9)]: return False
    br, bc = 3*(row//3), 3*(col//3)
    for r in range(br, br+3):
        for c in range(bc, bc+3):
            if board[r][c] == num: return False
    return True

def solve(board):
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                nums = list(range(1,10))
                random.shuffle(nums)
                for n in nums:
                    if is_valid(board, r, c, n):
                        board[r][c] = n
                        if solve(board): return True
                        board[r][c] = 0
                return False
    return True

def count_solutions(board, limit=2):
    count = [0]
    def bt(b):
        if count[0] >= limit: return
        for r in range(9):
            for c in range(9):
                if b[r][c] == 0:
                    for n in range(1,10):
                        if is_valid(b, r, c, n):
                            b[r][c] = n
                            bt(b)
                            b[r][c] = 0
                    return
        count[0] += 1
    bt([row[:] for row in board])
    return count[0]

def generate_puzzle(difficulty="medium"):
    board = [[0]*9 for _ in range(9)]
    solve(board)
    solution = copy.deepcopy(board)
    remove = DIFFICULTY.get(difficulty, 46)
    cells = [(r,c) for r in range(9) for c in range(9)]
    random.shuffle(cells)
    removed = 0
    for r, c in cells:
        if removed >= remove: break
        backup = board[r][c]
        board[r][c] = 0
        if count_solutions(board) != 1:
            board[r][c] = backup
        else:
            removed += 1
    return board, solution

@app.get("/api/puzzle")
def get_puzzle(difficulty: str = "medium"):
    puzzle, solution = generate_puzzle(difficulty)
    return {"puzzle": puzzle, "solution": solution, "difficulty": difficulty}

@app.get("/api/validate")
def validate(board: str):
    try:
        b = json.loads(board)
        for r in range(9):
            for c in range(9):
                n = b[r][c]
                if n == 0: continue
                b[r][c] = 0
                if not is_valid(b, r, c, n):
                    b[r][c] = n
                    return {"valid": False, "conflict": [r, c]}
                b[r][c] = n
        complete = all(b[r][c] != 0 for r in range(9) for c in range(9))
        return {"valid": True, "complete": complete}
    except Exception as e:
        return {"valid": False, "error": str(e)}

app.mount("/", StaticFiles(directory="static", html=True), name="static")
