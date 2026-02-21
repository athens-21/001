"""
Trading Journal - Routes Package
"""
from .accounts import accounts_bp
from .trades import trades_bp
from .analytics import analytics_bp
from .settings import settings_bp

__all__ = ['accounts_bp', 'trades_bp', 'analytics_bp', 'settings_bp']
