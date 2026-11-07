module.exports = {
  // Sets the testing environment to Node (crucial for backend Express API testing)
  testEnvironment: 'node',
  
  // Provides detailed output in your terminal for each individual test run
  verbose: true,
  
  // Automatically clears mock calls and instances between every test
  clearMocks: true,
  
  // Tells Jest to look inside your "tests" folders for any file ending in .test.js
  testMatch: [
    '**/tests/**/*.test.js'
  ]
};