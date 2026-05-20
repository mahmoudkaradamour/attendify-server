const { Worker } = require("bullmq");

const attendanceService =
  require("../services/attendance.service");

const logger =
  require("../infrastructure/logging/logger");

const {
  runWithContext
} = require("../observability/request-context");

const {
  trace
} = require("../infrastructure/tracing/tracer");

/**
 * BullMQ requires config (NOT redis instance)
 */
const worker = new Worker(
  "evidence-delivery",
  async (job) => {

    return runWithContext(
      {
        requestId: job.data?.requestId || `job-${job.id}`,
        traceId: job.data?.traceId || null,
        userId: null
      },
      async () => {

        return trace("worker.evidence.process", async () => {

          logger.info("Worker started", {
            jobId: job.id
          });

          try {

            await attendanceService.markAttendance(
              job.data
            );

            logger.info("Worker completed", {
              jobId: job.id
            });

          } catch (err) {

            logger.error("Worker failed", err, {
              jobId: job.id
            });

            throw err;
          }
        });
      }
    );
  },
  {
    connection: {
      connectionString: process.env.REDIS_URL
    }
  }
);

worker.on("failed", (job, err) => {
  logger.error("Job failed", err, {
    jobId: job?.id
  });
});

worker.on("completed", (job) => {
  logger.info("Job completed", {
    jobId: job.id
  });
});

async function close() {
  await worker.close();
}

module.exports = { worker, close };

/**
 * END OF FILE
 */
