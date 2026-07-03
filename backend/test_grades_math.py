"""
Unit tests for grades_math (stdlib unittest; pure, no deps, no DB).

Run:  PYTHONPATH=backend python3 -m unittest test_grades_math -v

Every expected number is a hand calculation, because the product promise is that
the goal-seek number matches what a student computes by hand off the syllabus.
"""

import unittest

from grades_math import (
    Category,
    Course,
    Cutoff,
    DropLowest,
    Item,
    RankWeights,
    Uniform,
    compute_standing,
    goal_seek,
    letter_for,
    slot_weights_desc,
    validate_rubric,
)

# Standard letter cutoffs reused across tests.
CUTOFFS = [
    Cutoff("A", 93),
    Cutoff("A-", 90),
    Cutoff("B+", 87),
    Cutoff("B", 83),
    Cutoff("B-", 80),
    Cutoff("F", 0),
]


def exams_only_course(graded, rule=RankWeights((7, 7, 7, 4))):
    """A single 25-point Exams category (for standing tests)."""
    return Course(
        name="t",
        categories=[Category("Exams", 25, rule, [Item(f"e{i}", s, m) for i, (s, m) in enumerate(graded)])],
        cutoffs=CUTOFFS,
    )


def two_category_course(exam_fracs):
    """Exams (25 pts, rank-weighted 7/7/7/4) + a fully-graded 75-pt 'Other' at 96%.

    The 75-pt Other contributes a fixed 72 points, so goal-seek must make the
    Exams category reach the rest.  exam_fracs are the already-graded exams.
    """
    exams = Category(
        "Exams",
        25,
        RankWeights((7, 7, 7, 4)),
        [Item(f"e{i}", f * 100, 100) for i, f in enumerate(exam_fracs)],
    )
    other = Category("Other", 75, Uniform(1), [Item("o", 96, 100)])
    return Course("t", [exams, other], CUTOFFS)


class TestSlotWeights(unittest.TestCase):
    def test_uniform(self):
        self.assertEqual(slot_weights_desc(Uniform(4), 20), [5, 5, 5, 5])

    def test_drop_lowest(self):
        # 3 slots, drop 1 -> two slots of 15 and one zero.
        self.assertEqual(slot_weights_desc(DropLowest(3, 1), 30), [15, 15, 0])

    def test_rank_weights_sorted_desc(self):
        self.assertEqual(slot_weights_desc(RankWeights((4, 7, 7, 7)), 25), [7, 7, 7, 4])


class TestStanding(unittest.TestCase):
    def test_uniform_full(self):
        c = Course("t", [Category("C", 100, Uniform(2), [Item("a", 80, 100), Item("b", 90, 100)])], CUTOFFS)
        s = compute_standing(c)
        # equal halves: (80 + 90) / 2 = 85
        self.assertAlmostEqual(s.percent, 85.0)
        self.assertEqual(s.letter, "B")

    def test_rank_weights_lowest_gets_small_weight(self):
        # 4 exams; lowest (0.50) must take the weight-4 slot, others the 7s.
        c = exams_only_course([(95, 100), (90, 100), (85, 100), (50, 100)])
        s = compute_standing(c)
        earned = 7 * 0.95 + 7 * 0.90 + 7 * 0.85 + 4 * 0.50  # = 20.9
        self.assertAlmostEqual(s.earned_points, earned)
        self.assertAlmostEqual(s.percent, earned / 25 * 100)  # 83.6 (grade in this category so far)

    def test_drop_lowest_excludes_worst(self):
        c = Course(
            "t",
            [Category("HW", 30, DropLowest(3, 1), [Item("h1", 90, 100), Item("h2", 70, 100), Item("h3", 50, 100)])],
            CUTOFFS,
        )
        s = compute_standing(c)
        # weights [15,15,0] -> 0.90*15 + 0.70*15 + 0.50*0 = 24 ; base 30 -> 80%
        self.assertAlmostEqual(s.earned_points, 24.0)
        self.assertAlmostEqual(s.percent, 80.0)

    def test_partial_grading_is_grade_so_far(self):
        # Only one of two uniform halves graded -> renormalized to graded work.
        c = Course("t", [Category("C", 100, Uniform(2), [Item("a", 88, 100)])], CUTOFFS)
        s = compute_standing(c)
        self.assertAlmostEqual(s.percent, 88.0)
        self.assertAlmostEqual(s.graded_weight, 50.0)

    def test_nothing_graded(self):
        c = Course("t", [Category("C", 100, Uniform(2), [])], CUTOFFS)
        s = compute_standing(c)
        self.assertIsNone(s.percent)
        self.assertIsNone(s.letter)


class TestCutoffs(unittest.TestCase):
    def test_boundary_is_inclusive(self):
        self.assertEqual(letter_for(93.0, CUTOFFS), "A")
        self.assertEqual(letter_for(92.999, CUTOFFS), "A-")

    def test_below_all(self):
        self.assertEqual(letter_for(10.0, CUTOFFS), "F")


class TestGoalSeek(unittest.TestCase):
    def test_uniform_matches_simple_formula(self):
        # Two equal halves; midterm 85 done, solve the final for an A- (90).
        c = Course(
            "t",
            [Category("C", 100, Uniform(2), [Item("mid", 85, 100)])],
            CUTOFFS,
        )
        r = goal_seek(c, "A-", "C", unknown_max_score=100)
        # 42.5 + 50*x = 90 -> x = 0.95 -> 95
        self.assertEqual(r.status, "ok")
        self.assertAlmostEqual(r.needed_score, 95.0, places=6)

    def test_uniform_a_is_infeasible_here(self):
        # Same setup, but a true A (93) needs 101 on the final -> infeasible.
        c = Course("t", [Category("C", 100, Uniform(2), [Item("mid", 85, 100)])], CUTOFFS)
        self.assertEqual(goal_seek(c, "A", "C", 100).status, "infeasible")

    def test_user_case_unknown_is_lowest(self):
        # THE motivating case: 3 exams done high; the 4th will be the lowest,
        # so it sits in the weight-4 slot.  Other = 72 fixed.  Need an A (93).
        c = two_category_course([0.95, 0.90, 0.85])
        r = goal_seek(c, "A", "Exams", unknown_max_score=100)
        # exams piece (x lowest): 18.9 + 4x ; +72 = 93 -> x = 0.525 -> 52.5
        self.assertEqual(r.status, "ok")
        self.assertAlmostEqual(r.needed_score, 52.5, places=6)
        # and the unknown really is the lowest here (below all graded exams)
        self.assertLess(r.needed_fraction, 0.85)

    def test_piecewise_unknown_becomes_top(self):
        # Lower graded exams; reaching an A forces the 4th exam ABOVE the others,
        # so it crosses rank slots and lands in a weight-7 slot (piecewise).
        c = two_category_course([0.90, 0.80, 0.60])
        r = goal_seek(c, "A", "Exams", unknown_max_score=100)
        # crossing in [.90,1]: total = 86.3 + 7x = 93 -> x = 0.9571428 -> 95.714
        self.assertEqual(r.status, "ok")
        self.assertAlmostEqual(r.needed_score, 95.7142857, places=4)
        # the unknown is now the TOP exam, not the lowest -> proves rank flip
        self.assertGreater(r.needed_fraction, 0.90)

    def test_harder_target_needs_more(self):
        # Monotonic in the target: an A must require at least as much as an A-.
        c = two_category_course([0.95, 0.90, 0.85])
        need_a = goal_seek(c, "A", "Exams", 100).needed_score
        need_aminus = goal_seek(c, "A-", "Exams", 100).needed_score
        self.assertGreaterEqual(need_a, need_aminus)

    def test_already_met(self):
        # 85 fixed points already clears a B- even if the exam is a zero.
        c = Course(
            "t",
            [
                Category("Done", 85, Uniform(1), [Item("d", 100, 100)]),
                Category("Exam", 15, Uniform(1), []),
            ],
            CUTOFFS,
        )
        r = goal_seek(c, "B-", "Exam", 100)
        self.assertEqual(r.status, "already_met")
        self.assertAlmostEqual(r.needed_score, 0.0)

    def test_infeasible(self):
        # Only 25 points banked; an A (93) is unreachable on a 50-pt final.
        c = Course(
            "t",
            [
                Category("Done", 50, Uniform(1), [Item("d", 50, 100)]),
                Category("Final", 50, Uniform(1), []),
            ],
            CUTOFFS,
        )
        r = goal_seek(c, "A", "Final", 100)
        self.assertEqual(r.status, "infeasible")
        self.assertIsNone(r.needed_score)

    def test_zero_max_score_is_infeasible(self):
        c = two_category_course([0.95, 0.90, 0.85])
        r = goal_seek(c, "A", "Exams", unknown_max_score=0)
        self.assertEqual(r.status, "infeasible")

    def test_unknown_category_missing_raises(self):
        c = two_category_course([0.95, 0.90, 0.85])
        with self.assertRaises(ValueError):
            goal_seek(c, "A", "Nope", 100)

    def test_monotonic_total_in_x(self):
        # Scoring higher on the unknown never lowers the result: needed_score is a
        # well-defined threshold, so a tiny target bump never reduces it.
        c = two_category_course([0.90, 0.80, 0.60])
        prev = -1.0
        for letter in ["B-", "B", "B+", "A-", "A"]:
            r = goal_seek(c, letter, "Exams", 100)
            if r.status == "ok":
                self.assertGreaterEqual(r.needed_score + 1e-9, prev)
                prev = r.needed_score


class TestValidate(unittest.TestCase):
    def test_weights_not_100(self):
        c = Course("t", [Category("A", 60, Uniform(1), []), Category("B", 30, Uniform(1), [])], CUTOFFS)
        warns = validate_rubric(c)
        self.assertTrue(any("sum to 90" in w for w in warns))

    def test_rank_weights_sum_mismatch(self):
        c = Course("t", [Category("Exams", 25, RankWeights((7, 7, 7, 7)), [])], CUTOFFS)  # sums to 28
        warns = validate_rubric(c)
        self.assertTrue(any("rank weights sum" in w for w in warns))

    def test_clean_rubric_no_weight_warning(self):
        c = two_category_course([0.9])
        warns = validate_rubric(c)
        self.assertFalse(any("sum to" in w for w in warns))

    def test_never_raises(self):
        # Garbage in -> warnings out, never an exception (non-blocking by design).
        c = Course("t", [Category("X", 0, DropLowest(2, 5), [Item("a", 1, 0)])], [])
        self.assertIsInstance(validate_rubric(c), list)


def _rl_course(final_score, m_scores=(80, 60), weights=(10, 10, 10)):
    """Exams: 2 midterms + 1 final (replacer). weights are points-of-100. cutoff A=90."""
    import grades_math as gm
    items = [
        gm.Item(name="M1", score=m_scores[0], max_score=100, weight=weights[0]),
        gm.Item(name="M2", score=m_scores[1], max_score=100, weight=weights[1]),
        gm.Item(name="Final", score=final_score, max_score=100, weight=weights[2], replacer=True),
    ]
    return gm.Course(
        name="C",
        categories=[gm.Category(name="Exams", weight=30, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)],
    )


def test_replace_lowest_boost_active():
    # Final 0.90 > lowest midterm M2 0.60 -> M2 lifted to 0.90.
    # earned = 10*0.80 + 10*0.90(lifted) + 10*0.90 = 8 + 9 + 9 = 26 ; graded_weight = 30
    import grades_math as gm
    s = gm.compute_standing(_rl_course(90))
    assert s.earned_points == 26.0
    assert s.graded_weight == 30.0
    assert s.percent == 26.0 / 30.0 * 100.0


def test_replace_lowest_boost_inactive():
    # Final 0.50 < lowest midterm 0.60 -> no boost.
    # earned = 10*0.80 + 10*0.60 + 10*0.50 = 8 + 6 + 5 = 19
    import grades_math as gm
    s = gm.compute_standing(_rl_course(50))
    assert s.earned_points == 19.0


def test_replace_lowest_no_boost_when_replacer_ungraded():
    # Only midterms graded (final stripped as null upstream): behaves like fixedWeights.
    import grades_math as gm
    items = [
        gm.Item(name="M1", score=80, max_score=100, weight=10),
        gm.Item(name="M2", score=60, max_score=100, weight=10),
    ]
    course = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=20, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    s = gm.compute_standing(course)
    assert s.earned_points == 8.0 + 6.0  # no boost


def test_replace_lowest_only_replacer_graded_no_lowest():
    import grades_math as gm
    items = [gm.Item(name="Final", score=90, max_score=100, weight=10, replacer=True)]
    course = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=10, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    assert gm.compute_standing(course).earned_points == 9.0


def test_validate_replace_lowest_warns_on_replacer_count():
    import grades_math as gm
    items = [gm.Item(name="M1", score=80, max_score=100, weight=10),
             gm.Item(name="M2", score=60, max_score=100, weight=10)]  # zero replacers
    course = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=20, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    warns = gm.validate_rubric(course)
    assert any("exactly one" in w for w in warns)


if __name__ == "__main__":
    unittest.main()


def _rl_goal_course(m_scores, final_score=None, weights=(10, 10, 10)):
    """Exams (ReplaceLowest): M1,M2 graded; Final graded only if final_score given.
    cutoff A=90 on a 30-pt category = /30 scale."""
    import grades_math as gm
    items = [gm.Item(name="M1", score=m_scores[0], max_score=100, weight=weights[0]),
             gm.Item(name="M2", score=m_scores[1], max_score=100, weight=weights[1])]
    if final_score is not None:
        items.append(gm.Item(name="Final", score=final_score, max_score=100, weight=weights[2], replacer=True))
    return gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=30, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)])


def test_goal_seek_replacer_unknown_boost_side():
    # M1=1.0, M2=0.5 graded; Final is the unknown (replacer), weight 10, target A=90% of /30 -> 27.0.
    # For x>0.5 M2(0.5) is lifted to x: total = 10*1 + 10*0.5 + 10x + 10*(x-0.5) = 10 + 20x. =27 -> x=0.85.
    import grades_math as gm
    c = _rl_goal_course((100, 50))
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=True)
    assert r.status == "ok"
    assert abs(r.needed_score - 85.0) < 1e-6


def test_goal_seek_replacer_unknown_below_breakpoint():
    # M1=1.0, M2=0.95 graded; Final unknown replacer. For x<=0.95 (no boost): total = 10 + 9.5 + 10x.
    # =27 -> 10x = 7.5 -> x=0.75 (<0.95 so no boost, consistent). needed 75.
    import grades_math as gm
    c = _rl_goal_course((100, 95))
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=True)
    assert r.status == "ok"
    assert abs(r.needed_score - 75.0) < 1e-6


def test_goal_seek_nonreplacer_unknown_full_piecewise():
    # M1=1.0 and Final=1.0 (replacer) graded; M2 is the UNKNOWN non-replacer (weight 10).
    # For x<1.0 M2 is lowest non-rep and is lifted to frac_rep=1.0: base=10*1+10*x+10*1=20+10x;
    # boost=10*(1.0-x); total=30 (constant) >= target 27 at every x -> already_met, needed 0.
    import grades_math as gm
    c = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=30, rule=gm.ReplaceLowest(), items=[
            gm.Item(name="M1", score=100, max_score=100, weight=10),
            gm.Item(name="Final", score=100, max_score=100, weight=10, replacer=True),
        ])],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)])
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=False)
    assert r.status in ("already_met", "ok")
    assert (r.needed_score or 0.0) < 1e-6


def test_goal_seek_replace_lowest_requires_weight():
    import grades_math as gm, pytest
    c = _rl_goal_course((100, 50))
    with pytest.raises(ValueError):
        gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=None, unknown_is_replacer=True)


def test_goal_seek_replace_lowest_infeasible():
    import grades_math as gm
    c = _rl_goal_course((0, 0))  # even a perfect boosted final can't reach 90% of /30
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=True)
    assert r.status == "infeasible"
