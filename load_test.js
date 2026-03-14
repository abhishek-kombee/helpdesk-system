import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const ticketListDuration = new Trend('ticket_list_duration');
const ticketCreateDuration = new Trend('ticket_create_duration');
const ticketDetailDuration = new Trend('ticket_detail_duration');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Stage 1: ramp up to 50 VUs
    { duration: '2m', target: 50 },    // Stage 2: hold 50 VUs
    { duration: '30s', target: 200 },  // Stage 3: spike to 200 VUs
    { duration: '1m', target: 0 },     // Stage 4: ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
};

// Test users
const TEST_USERS = [
  { email: 'agent1@helpdesk.com', password: 'Agent123!@#' },
  { email: 'agent2@helpdesk.com', password: 'Agent123!@#' },
  { email: 'customer1@helpdesk.com', password: 'Customer123!@#' },
  { email: 'customer2@helpdesk.com', password: 'Customer123!@#' },
];

function getRandomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

function getHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

export default function () {
  const user = getRandomUser();
  let token = null;
  let ticketId = null;

  // Scenario 1: Login
  group('Login', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/login/`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    loginDuration.add(loginRes.timings.duration);

    const success = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login has access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.tokens && body.tokens.access;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);

    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        token = body.tokens.access;
      } catch {}
    }
  });

  if (!token) {
    sleep(1);
    return;
  }

  sleep(0.5);

  // Scenario 2: List tickets
  group('List Tickets', () => {
    const listRes = http.get(
      `${BASE_URL}/api/tickets/`,
      getHeaders(token)
    );

    ticketListDuration.add(listRes.timings.duration);

    const success = check(listRes, {
      'list tickets status is 200': (r) => r.status === 200,
      'list tickets has results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.results !== undefined;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);

    // Get a ticket ID for detail view
    if (listRes.status === 200) {
      try {
        const body = JSON.parse(listRes.body);
        if (body.results && body.results.length > 0) {
          ticketId = body.results[0].id;
        }
      } catch {}
    }
  });

  sleep(0.5);

  // Scenario 3: Create a ticket
  group('Create Ticket', () => {
    const priorities = ['low', 'medium', 'high'];
    const createRes = http.post(
      `${BASE_URL}/api/tickets/`,
      JSON.stringify({
        title: `Load Test Ticket ${Date.now()}`,
        description: `This is a ticket created during load testing at ${new Date().toISOString()}`,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
      }),
      getHeaders(token)
    );

    ticketCreateDuration.add(createRes.timings.duration);

    const success = check(createRes, {
      'create ticket status is 201': (r) => r.status === 201,
    });

    errorRate.add(!success);

    if (createRes.status === 201) {
      try {
        const body = JSON.parse(createRes.body);
        ticketId = body.id;
      } catch {}
    }
  });

  sleep(0.5);

  // Scenario 4: View ticket detail
  if (ticketId) {
    group('View Ticket Detail', () => {
      const detailRes = http.get(
        `${BASE_URL}/api/tickets/${ticketId}/`,
        getHeaders(token)
      );

      ticketDetailDuration.add(detailRes.timings.duration);

      const success = check(detailRes, {
        'ticket detail status is 200': (r) => r.status === 200,
        'ticket detail has title': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.title !== undefined;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!success);
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in text summary
  return JSON.stringify(data, null, 2);
}
