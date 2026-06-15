"""Repository layer: SQLAlchemy data access, isolated from the service layer (spec §5.3).

Repositories also keep the app-layer ``WHERE household_id`` filter explicit — the
defense-in-depth partner to the RLS net (plan §3.6 app-layer).
"""
