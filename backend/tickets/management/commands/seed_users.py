"""Management command to create seed users for testing."""
from django.core.management.base import BaseCommand
from tickets.models import User


class Command(BaseCommand):
    help = 'Create seed users for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--noinput',
            action='store_true',
            help='Run without prompting for input',
        )

    def handle(self, *args, **options):
        users = [
            {
                'username': 'agent1',
                'email': 'agent1@helpdesk.com',
                'password': 'Agent123!@#',
                'role': 'agent',
            },
            {
                'username': 'agent2',
                'email': 'agent2@helpdesk.com',
                'password': 'Agent123!@#',
                'role': 'agent',
            },
            {
                'username': 'customer1',
                'email': 'customer1@helpdesk.com',
                'password': 'Customer123!@#',
                'role': 'customer',
            },
            {
                'username': 'customer2',
                'email': 'customer2@helpdesk.com',
                'password': 'Customer123!@#',
                'role': 'customer',
            },
        ]

        for user_data in users:
            if not User.objects.filter(email=user_data['email']).exists():
                User.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password=user_data['password'],
                    role=user_data['role'],
                )
                self.stdout.write(
                    self.style.SUCCESS(f"Created user: {user_data['username']} ({user_data['role']})")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f"User already exists: {user_data['email']}")
                )
