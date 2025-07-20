# Async Context Demo (TypeScript)

This demo project done to learn how Node.js stores and manages execution contexts during async operations, written in TypeScript with full type safety.

## Setup

```bash
npm install
```

## Running the Demo

### 1. Development Mode (TypeScript directly)
```bash
npm run dev
```

### 2. Production Mode (Compiled JavaScript)
```bash
npm start
```

### 3. With Async Stack Traces (Most Important!)
```bash
# Development
npm run debug-dev

# Production
npm run debug
```

### 4. With Inspector (for Chrome DevTools debugging)
```bash
# Development
npm run inspect-dev

# Production
npm run inspect
```
Then open Chrome and go to `chrome://inspect`

### 5. With All Debugging Features
```bash
npm run trace
```

### 6. With Heap Snapshots
```bash
npm run heap
```

### 7. Watch Mode (for development)
```bash
npm run watch
```

## TypeScript Features

### 1. **Full Type Safety**
- All request/response objects are properly typed
- Database results have defined interfaces
- Error handling includes proper type annotations
- No `any` types except for error handling

### 2. **Interface Definitions**
```typescript
interface DBResult {
    id: number;
    query: string;
    timestamp: string;
    data: string;
}

interface ProcessedUserData extends DBResult {
    preferences: DBResult;
    processingTime: number;
    requestId: string;
}
```

### 3. **Type-Safe Async Operations**
All Promise types are explicitly defined, making the async context storage even clearer.

## Build System

### Compile TypeScript
```bash
npm run build
```

### Clean Build Directory
```bash
npm run clean
```

### Watch Mode (auto-recompile)
```bash
npm run watch
```

### Test Single Request
```bash
curl http://localhost:3000/user/123
```

### Test Concurrent Requests (This is the key!)
Open multiple terminals and run these simultaneously:
```bash
# Terminal 1
curl http://localhost:3000/user/1

# Terminal 2 (run immediately after)
curl http://localhost:3000/user/2

# Terminal 3 (run immediately after)
curl http://localhost:3000/user/3
```

Or use this one-liner to send concurrent requests:
```bash
curl http://localhost:3000/user/1 & curl http://localhost:3000/user/2 & curl http://localhost:3000/user/3 & wait
```

### Stress Test
```bash
curl http://localhost:3000/stress-test
```

## What You'll See

### 1. Context Preservation
Watch the console output - you'll see that each request maintains its own:
- `userId`
- `requestId` 
- `startTime`
- `req` and `res` objects

Even when multiple requests are processed concurrently!

### 2. Memory Usage
The app logs memory usage to show how contexts are stored in heap memory.

### 3. Async Stack Traces
With `--async-stack-traces`, you'll see complete stack traces that span across async boundaries:

```
Error: Something went wrong
    at /path/to/async-context-demo.js:45:15
    at processTicksAndRejections (node:internal/process/task_queues.js:93:5)
    at async /path/to/async-context-demo.js:38:26  <-- This shows the async context!
```

### 4. Timing Analysis
Each request logs:
- When it starts
- When it pauses at `await`
- When context is restored
- Total processing time

## Key Observations

### Concurrent Processing
```
🚀 [abc123] Request started for user 1
🚀 [def456] Request started for user 2    <-- Second request starts while first is waiting
⏸️  [abc123] About to await - Node.js will save context here
⏸️  [def456] About to await - Node.js will save context here
🔄 [abc123] Context restored! All variables still available    <-- First request resumes
🔄 [def456] Context restored! All variables still available    <-- Second request resumes
```

### Context Isolation
Each request maintains its own isolated execution context - no variable bleeding between requests!

## Advanced Debugging

### Heap Snapshots
```bash
node --heapsnapshot-signal=SIGUSR2 async-context-demo.js
```
Then send `kill -USR2 <pid>` to take heap snapshots and see context storage.

### Inspector with Breakpoints
1. Run with `--inspect`
2. Open Chrome DevTools
3. Set breakpoints before and after `await`
4. Inspect the call stack and scope variables

## Understanding the Output

The demo clearly shows:
1. **Context Creation**: When async function starts
2. **Context Storage**: When `await` is hit
3. **Context Restoration**: When async operation completes
4. **Context Cleanup**: When request finishes (via garbage collection)

This demonstrates how Node.js uses closures and the event loop to maintain execution state across async operations!