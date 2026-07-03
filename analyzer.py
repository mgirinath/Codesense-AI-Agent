"""
Static analysis of submitted code — WITHOUT executing it. Running arbitrary
user-submitted code on a public server is a security risk (it could read
files, make network calls, consume all your CPU, etc), so instead we parse
the code's structure and catch a wide class of real bugs safely.
"""
import ast
import io

from pyflakes.api import check
from pyflakes.reporter import Reporter


def check_python(code: str) -> list[str]:
    """Run a syntax check + pyflakes static analysis on Python code.
    Returns a list of human-readable issue strings (empty if none found)."""
    issues: list[str] = []

    # 1. Syntax check — catches things that would crash on import
    try:
        ast.parse(code)
    except SyntaxError as e:
        issues.append(f"SyntaxError on line {e.lineno}: {e.msg}")
        return issues  # pyflakes can't run on code that doesn't parse

    # 2. pyflakes — catches undefined names, unused imports, unused
    #    variables, redefinitions, etc, all without executing anything
    out, err = io.StringIO(), io.StringIO()
    reporter = Reporter(out, err)
    check(code, "submitted_code.py", reporter)

    for line in out.getvalue().splitlines():
        issues.append(line.split("submitted_code.py:", 1)[-1].strip())

    return issues


def check_generic(code: str, language: str) -> list[str]:
    """For non-Python languages we don't have a safe static checker wired
    up yet, so we're upfront about that rather than pretending to test it."""
    return [f"No automated static checker available for {language} yet — "
            f"the LLM review below is based on reading the code only."]


def run_checks(code: str, language: str) -> list[str]:
    if language.lower() == "python":
        return check_python(code)
    return check_generic(code, language)
