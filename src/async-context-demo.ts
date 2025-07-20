import express, { NextFunction, Request, Response } from 'express';

const app = express();

// Enhanced memory tracking
let requestCounter = 0;
const activeRequests = new Map<string, number>();

// Middleware to log memory usage (MUST be before routes)
app.use((req: Request, res: Response, next: NextFunction): void => {
    requestCounter++;
    const memUsage = process.memoryUsage();
    console.log(`💾 [REQ-${requestCounter}] Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap | Active contexts: ${activeRequests.size}`);
    next();
});

// Type definitions
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

interface RequestContext {
    userId: string;
    requestId: string;
    startTime: number;
    hasReq: boolean;
    hasRes: boolean;
}

interface StressTestResult {
    message: string;
    results: Array<ProcessedUserData | { error: string; userId: number }>;
    totalRequests: number;
}

// Simulate database query with delay
function simulateDBQuery(query: string, delay: number = 3000): Promise<DBResult> {
    return new Promise((resolve) => {
        console.log(`🔍 Starting DB query: "${query}" (will take ${delay}ms)`);
        setTimeout(() => {
            const result: DBResult = {
                id: Math.floor(Math.random() * 1000),
                query: query,
                timestamp: new Date().toISOString(),
                data: `Result for ${query}`
            };
            console.log(`✅ DB query completed: "${query}"`);
            resolve(result);
        }, delay);
    });
}

// Route that demonstrates async context storage
app.get('/user/:id', async (req: Request, res: Response): Promise<void> => {
    const userId: string = req.params.id;
    const requestId: string = Math.random().toString(36).substring(7);
    const startTime: number = Date.now();

    // Track this request as active
    activeRequests.set(requestId, startTime);

    console.log(`\n🚀 [${requestId}] Request started for user ${userId}`);

    const contextBeforeAwait: RequestContext = {
        userId,
        requestId,
        startTime,
        hasReq: !!req,
        hasRes: !!res
    };

    console.log(`📊 [${requestId}] Local variables at start:`, contextBeforeAwait);

    // Show memory before await
    const memBefore = process.memoryUsage();
    console.log(`🧠 [${requestId}] Memory before await: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);

    try {
        // This is where Node.js saves the execution context
        console.log(`⏸️  [${requestId}] About to await - Node.js will save context here`);

        // Simulate concurrent DB queries
        const [userData, userPreferences]: [DBResult, DBResult] = await Promise.all([
            simulateDBQuery(`SELECT * FROM users WHERE id=${userId}`, 3000),
            simulateDBQuery(`SELECT * FROM preferences WHERE user_id=${userId}`, 2000)
        ]);

        // Execution resumes here - Node.js restored the context
        const endTime: number = Date.now();

        // Show memory after await
        const memAfter = process.memoryUsage();
        console.log(`🧠 [${requestId}] Memory after await: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);

        const contextAfterAwait: RequestContext = {
            userId: userId,
            requestId: requestId,
            startTime: startTime,
            hasReq: !!req,
            hasRes: !!res
        };

        console.log(`🔄 [${requestId}] Context restored! All variables still available:`, {
            ...contextAfterAwait,
            duration: endTime - startTime
        });

        // Process the results
        const processedData: ProcessedUserData = {
            ...userData,
            preferences: userPreferences,
            processingTime: endTime - startTime,
            requestId: requestId
        };

        console.log(`✨ [${requestId}] Sending response after ${endTime - startTime}ms`);

        // Remove from active requests
        activeRequests.delete(requestId);

        res.json(processedData);

    } catch (error: any) {
        console.error(`❌ [${requestId}] Error:`, error);
        activeRequests.delete(requestId);
        res.status(500).json({
            error: 'Internal server error',
            requestId,
            message: error?.message || 'Unknown error'
        });
    }
});

// Route to create memory pressure and show context storage
app.get('/memory-test/:concurrent', async (req: Request, res: Response): Promise<void> => {
    const concurrentRequests = parseInt(req.params.concurrent) || 10;
    console.log(`\n🔥 MEMORY TEST: Creating ${concurrentRequests} concurrent contexts...`);

    const memBefore = process.memoryUsage();
    console.log(`🧠 Memory before test: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);

    const promises = [];

    for (let i = 1; i <= concurrentRequests; i++) {
        promises.push(
            new Promise(async (resolve) => {
                const requestId = `memory-test-${i}`;
                activeRequests.set(requestId, Date.now());

                // Create some data to make context storage more visible
                const largeData = new Array(1000).fill(`Context data for request ${i}`);

                try {
                    console.log(`⏸️  [${requestId}] Storing context with ${largeData.length} items`);

                    // This creates a stored context with the largeData array
                    await simulateDBQuery(`Heavy query for request ${i}`, 2000 + (i * 100));

                    console.log(`🔄 [${requestId}] Context restored with ${largeData.length} items`);
                    activeRequests.delete(requestId);
                    resolve({ requestId, dataSize: largeData.length });
                } catch (error: any) {
                    activeRequests.delete(requestId);
                    resolve({ error: error.message, requestId });
                }
            })
        );
    }

    // Show memory during concurrent execution
    setTimeout(() => {
        const memDuring = process.memoryUsage();
        console.log(`🧠 Memory during concurrent execution: ${Math.round(memDuring.heapUsed / 1024 / 1024)}MB | Active: ${activeRequests.size}`);
    }, 1000);

    const results = await Promise.all(promises);

    const memAfter = process.memoryUsage();
    console.log(`🧠 Memory after test: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);

    // Force garbage collection if available (run with --expose-gc)
    if (global.gc) {
        console.log('🗑️  Running garbage collection...');
        global.gc();
        const memAfterGC = process.memoryUsage();
        console.log(`🧠 Memory after GC: ${Math.round(memAfterGC.heapUsed / 1024 / 1024)}MB`);
    }

    res.json({
        message: `Memory test completed with ${concurrentRequests} concurrent requests`,
        memoryBefore: Math.round(memBefore.heapUsed / 1024 / 1024),
        memoryAfter: Math.round(memAfter.heapUsed / 1024 / 1024),
        results: results.length
    });
});
app.get('/stress-test', async (req: Request, res: Response): Promise<void> => {
    console.log('\n🔥 STRESS TEST: Starting multiple concurrent requests...');

    const promises: Promise<ProcessedUserData | { error: string; userId: number }>[] = [];

    for (let i = 1; i <= 5; i++) {
        // Simulate multiple requests to /user/:id endpoint internally
        promises.push(
            new Promise(async (resolve) => {
                try {
                    const userId = i.toString();
                    const requestId = Math.random().toString(36).substring(7);
                    const startTime = Date.now();

                    console.log(`🚀 [${requestId}] Internal request started for user ${userId}`);

                    const [userData, userPreferences] = await Promise.all([
                        simulateDBQuery(`SELECT * FROM users WHERE id=${userId}`, 3000),
                        simulateDBQuery(`SELECT * FROM preferences WHERE user_id=${userId}`, 2000)
                    ]);

                    const endTime = Date.now();
                    const result: ProcessedUserData = {
                        ...userData,
                        preferences: userPreferences,
                        processingTime: endTime - startTime,
                        requestId: requestId
                    };

                    resolve(result);
                } catch (error: any) {
                    resolve({
                        error: error?.message || 'Unknown error',
                        userId: i
                    });
                }
            })
        );
    }

    try {
        const results = await Promise.all(promises);
        const response: StressTestResult = {
            message: 'Stress test completed',
            results: results,
            totalRequests: results.length
        };
        res.json(response);
    } catch (error: any) {
        res.status(500).json({
            error: 'Stress test failed',
            message: error?.message || 'Unknown error'
        });
    }
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
    console.error('🚨 Unhandled error:', error);
    console.trace(); // This will show the async stack trace
    res.status(500).json({
        error: 'Something went wrong!',
        message: error.message
    });
});

const PORT: number = parseInt(process.env.PORT || '3000');

app.listen(PORT, (): void => {
    console.log(`🎯 Server running on port ${PORT}`);
    console.log(`\n📖 Usage instructions:`);
    console.log(`1. Test single request: curl http://localhost:${PORT}/user/123`);
    console.log(`2. Test concurrent requests: curl http://localhost:${PORT}/stress-test`);
    console.log(`\n🔧 Debug commands:`);
    console.log(`• Run with async stack traces: npm run debug`);
    console.log(`• Run with inspector: npm run inspect`);
    console.log(`• Run with heap snapshots: npm run heap`);
    console.log(`\n🧪 Try opening multiple terminals and running:`);
    console.log(`curl http://localhost:${PORT}/user/1 & curl http://localhost:${PORT}/user/2 & curl http://localhost:${PORT}/user/3`);
});

// Graceful shutdown
process.on('SIGINT', (): void => {
    console.log('\n👋 Shutting down gracefully...');
    process.exit(0);
});

// Export for testing
export default app;