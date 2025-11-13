# Integration Tests for LMS Backend

This directory contains integration tests for the Learning Management System backend.

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Run tests:

    ```bash
    # Run all tests
    npm test

    # Run integration tests only
    npm run test:integration

    # Run tests in watch mode
    npm run test:watch
    ```

## Test Structure

### Backend Integration Tests (`tests/integration/`)

- **`auth-flow.integration.test.js`**: Tests the complete user journey from registration to quiz submission
  - User registration and login
  - Instructor registration and course creation
  - Student course enrollment
  - Quiz creation, attempt, and submission
  - Results verification

### Test Setup

- **In-memory MongoDB**: Uses `mongodb-memory-server` for isolated test database
- **Supertest**: HTTP endpoint testing
- **Jest**: Test framework with custom setup

### Key Features Tested

1. **Authentication Flow**:
   - User registration with validation
   - Login with JWT token generation
   - Token-based authentication middleware

2. **Course Management**:
   - Instructor course creation
   - Student enrollment with payment simulation
   - Course access control

3. **Quiz System**:
   - Quiz creation by instructors
   - Quiz retrieval for enrolled students
   - Quiz attempt initialization
   - Answer submission and grading
   - Results calculation and display

### Data Flow Verification

The integration tests verify that data flows correctly through the entire system:

1. **User Data**: Registration → Login → Token Storage → API Authentication
2. **Course Data**: Creation → Enrollment → Access Control → Quiz Association
3. **Quiz Data**: Creation → Attempt → Submission → Grading → Results

### Mock Data

Tests use realistic mock data that mirrors production scenarios:

- Dynamic timestamps and unique identifiers
- Valid email formats and secure passwords
- Complete course and quiz structures
- Realistic payment and enrollment data

### Running Individual Tests

```bash
# Run specific test file
npm test auth-flow.integration.test.js

# Run with verbose output
npm test -- --verbose
```

### Test Coverage

Current tests cover:

- ✅ User registration and authentication
- ✅ Course creation and enrollment
- ✅ Quiz lifecycle (create → attempt → submit → results)
- ✅ Authorization and access control
- ✅ Error handling and validation
- ✅ Data persistence and retrieval

### Environment Variables

Tests use the following environment variables (configured in your `.env` file):

- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token secret

### Troubleshooting

**Common Issues:**

1. **Port conflicts**: Ensure port 5001 is available for tests
2. **MongoDB connection**: Tests use in-memory MongoDB, ensure no external connections
3. **Timeout errors**: Increase `testTimeout` in `jest.config.js` if needed

**Debug Mode:**

```bash
DEBUG=jest:* npm test
```
