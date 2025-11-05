/**
 * Job Scheduler
 * Schedules automatic forecasting runs
 */

const schedule = require('node-schedule');
const logger = require('./utils/logger');
const config = require('./config');
const orchestrator = require('./orchestrator');

/**
 * Schedule daily forecasting job
 * @returns {Object} Scheduled job
 */
function scheduleDailyForecasting() {
  if (!config.scheduling.enableScheduler) {
    logger.info('Scheduler is disabled in configuration');
    return null;
  }

  const [hour, minute] = config.scheduling.forecastGenerationTime.split(':').map(Number);

  // Schedule job to run daily at specified time
  const rule = new schedule.RecurrenceRule();
  rule.hour = hour;
  rule.minute = minute;
  rule.tz = config.regional.timezone;

  const job = schedule.scheduleJob(rule, async () => {
    logger.info('Scheduled forecasting job triggered');

    try {
      const result = await orchestrator.runForecasting();

      if (result.success) {
        logger.info('Scheduled forecasting completed successfully', {
          statistics: result.statistics,
          reportPath: result.reportPath,
        });
      } else {
        logger.error('Scheduled forecasting failed', { error: result.error });
      }
    } catch (error) {
      logger.error('Scheduled forecasting threw an error', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info(`Forecasting scheduled to run daily at ${config.scheduling.forecastGenerationTime} (${config.regional.timezone})`);

  return job;
}

/**
 * Cancel scheduled job
 * @param {Object} job
 */
function cancelScheduledJob(job) {
  if (job) {
    job.cancel();
    logger.info('Scheduled job cancelled');
  }
}

module.exports = {
  scheduleDailyForecasting,
  cancelScheduledJob,
};
