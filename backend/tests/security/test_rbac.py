"""RBAC engine tests (plan §4.2). Pure-unit: the gate resolves permissions from the
in-memory catalogue keyed by the token role, so no DB is needed here. Cross-tenant /
service-level enforcement lands with the services that use the gate (4.3+)."""

import json
from pathlib import Path

import pytest

from app.domain.enums import ROLE_PERMISSIONS
from app.domain.enums import Role as RoleEnum
from app.security.rbac import (
    MembershipContext,
    require_permission,
    resolve_permissions,
)
from app.services.exceptions import PermissionDenied

# Shared catalogue, also read by the @homeops/core Vitest parity test.
_FIXTURE = Path(__file__).parents[3] / "tests" / "fixtures" / "role_permissions.json"
_CATALOGUE: dict[str, list[str]] = json.loads(_FIXTURE.read_text())["roles"]


def _ctx(role: RoleEnum) -> MembershipContext:
    return MembershipContext(user_id="u", household_id="h", role=role)


def test_catalogue_matches_shared_fixture() -> None:
    # Backend source of truth is pinned to the cross-stack contract.
    as_strings = {role.value: perms for role, perms in ROLE_PERMISSIONS.items()}
    assert as_strings == _CATALOGUE


def test_owner_can_delete_household() -> None:
    require_permission(_ctx(RoleEnum.OWNER), "household.delete")  # no raise


def test_admin_cannot_delete_household() -> None:
    with pytest.raises(PermissionDenied):
        require_permission(_ctx(RoleEnum.ADMIN), "household.delete")


def test_viewer_cannot_write() -> None:
    with pytest.raises(PermissionDenied):
        require_permission(_ctx(RoleEnum.VIEWER), "obligation.write")
    with pytest.raises(PermissionDenied):
        require_permission(_ctx(RoleEnum.VIEWER), "expense.write")


def test_child_cannot_read_expenses() -> None:
    with pytest.raises(PermissionDenied):
        require_permission(_ctx(RoleEnum.CHILD), "expense.read")


@pytest.mark.parametrize("role", [RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.MEMBER, RoleEnum.CHILD])
def test_every_role_can_read_obligations(role: RoleEnum) -> None:
    require_permission(_ctx(role), "obligation.read")  # no raise


def test_financial_roles_have_expense_read() -> None:
    for role in (RoleEnum.OWNER, RoleEnum.ADMIN, RoleEnum.MEMBER):
        assert "expense.read" in resolve_permissions(role)
    for role in (RoleEnum.VIEWER, RoleEnum.CHILD):
        assert "expense.read" not in resolve_permissions(role)


def test_permission_denied_carries_the_permission() -> None:
    with pytest.raises(PermissionDenied) as exc:
        require_permission(_ctx(RoleEnum.CHILD), "expense.read")
    assert exc.value.permission == "expense.read"


def test_resolve_unknown_role_is_empty() -> None:
    # Defensive: a role outside the catalogue grants nothing.
    assert resolve_permissions(RoleEnum.CHILD) != []
