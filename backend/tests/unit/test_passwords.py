from app.security.passwords import Passwords

# Low cost keeps the unit test fast; production params come from config.
_pw = Passwords(memory_cost=8192, time_cost=1, parallelism=1)


def test_hash_is_argon2id_and_verifies() -> None:
    h = _pw.hash("correct horse battery staple")
    assert h.startswith("$argon2id$")
    assert _pw.verify(h, "correct horse battery staple") is True


def test_verify_rejects_wrong_password() -> None:
    h = _pw.hash("right-password")
    assert _pw.verify(h, "wrong-password") is False


def test_verify_handles_garbage_hash_without_raising() -> None:
    assert _pw.verify("not-a-real-hash", "whatever") is False


def test_needs_rehash_when_params_increase() -> None:
    weak = Passwords(memory_cost=8192, time_cost=1, parallelism=1).hash("x")
    strong = Passwords(memory_cost=65536, time_cost=3, parallelism=2)
    assert strong.needs_rehash(weak) is True
