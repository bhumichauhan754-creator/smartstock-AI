"""WSGI config for SmartStock."""

import os

from django.core.wsgi import get_wsgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smartstock.settings")
application = get_wsgi_application()
