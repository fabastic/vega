from whiteroom.metrics import entropy, repetition, sequence_repeat_rate, spearman, stereotypy, time_errors


def test_entropy_known_answers():
    assert entropy(["a", "b", "c", "d"]) == 2.0
    assert entropy(["a"] * 10) == 0.0


def test_stereotypy_and_repetition():
    assert stereotypy(["a", "a", "b", "a"]) == 0.75
    r = repetition(["a", "a", "b", "b", "b", "c"])
    assert r["mean_run"] == 2.0 and abs(r["same_as_prev"] - 3 / 5) < 1e-12


def test_sequence_repeat_rate_periodic():
    seq = list("abcd") * 12
    assert sequence_repeat_rate(seq, 4) > 0.9
    assert sequence_repeat_rate(list("abcdefghijklmnop"), 4) == 0.0


def test_time_error_sign():
    rows = [{"tau": t, "S": 100 + 1.5 * t} for t in range(1, 11)]
    assert all(abs(e - 0.5) < 1e-12 for e in time_errors(rows, 100))


def test_spearman():
    assert spearman([1, 2, 3, 4], [10, 20, 30, 40]) == 1.0
    assert spearman([1, 1, 1], [1, 2, 3]) is None
