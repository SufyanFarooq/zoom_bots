import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();

// Configuration
const config = {
  port: process.env.PORT || 3000,
  totalContainers: parseInt(process.env.TOTAL_CONTAINERS) || 3,
  botsPerContainer: parseInt(process.env.BOTS_PER_CONTAINER) || 6,
  maxContainers: parseInt(process.env.MAX_CONTAINERS) || 167, // For 1000 bots
  environment: process.env.NODE_ENV || 'development'
};

// Global state
let orchestratorStats = {
  totalContainers: 0,
  activeContainers: 0,
  totalBots: 0,
  activeBots: 0,
  successfulBots: 0,
  failedBots: 0,
  startTime: Date.now(),
  lastUpdate: Date.now()
};

console.log('🎯 Zoom Bot Orchestrator Starting...');
console.log(`📊 Configuration:`);
console.log(`   - Environment: ${config.environment}`);
console.log(`   - Port: ${config.port}`);
console.log(`   - Max containers: ${config.maxContainers}`);
console.log(`   - Bots per container: ${config.botsPerContainer}`);
console.log(`   - Max bots: ${config.maxContainers * config.botsPerContainer}`);

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: config.environment,
    uptime: Math.round((Date.now() - orchestratorStats.startTime) / 1000),
    stats: orchestratorStats
  });
});

// Get orchestrator status
app.get('/status', (req, res) => {
  const uptime = Math.round((Date.now() - orchestratorStats.startTime) / 1000);
  const successRate = orchestratorStats.totalBots > 0 
    ? (orchestratorStats.successfulBots / orchestratorStats.totalBots * 100).toFixed(1)
    : 0;

  res.json({
    orchestrator: {
      uptime: uptime,
      environment: config.environment,
      maxCapacity: {
        containers: config.maxContainers,
        bots: config.maxContainers * config.botsPerContainer
      }
    },
    current: orchestratorStats,
    performance: {
      successRate: `${successRate}%`,
      averageBotsPerContainer: orchestratorStats.activeContainers > 0 
        ? (orchestratorStats.activeBots / orchestratorStats.activeContainers).toFixed(1)
        : 0
    },
    lastUpdate: new Date(orchestratorStats.lastUpdate).toISOString()
  });
});

// Start meeting with specified number of bots
app.post('/start-meeting', async (req, res) => {
  try {
    const { meetingUrl, passcode, totalBots = 60 } = req.body;
    
    if (!meetingUrl || !passcode) {
      return res.status(400).json({ 
        error: 'meetingUrl and passcode are required' 
      });
    }

    const containersNeeded = Math.ceil(totalBots / config.botsPerContainer);
    
    if (containersNeeded > config.maxContainers) {
      return res.status(400).json({
        error: `Requested ${totalBots} bots requires ${containersNeeded} containers, but max is ${config.maxContainers}`,
        maxBots: config.maxContainers * config.botsPerContainer
      });
    }

    console.log(`🚀 Starting meeting with ${totalBots} bots across ${containersNeeded} containers`);

    // Update stats
    orchestratorStats.totalContainers = containersNeeded;
    orchestratorStats.totalBots = totalBots;
    orchestratorStats.lastUpdate = Date.now();

    // In Kubernetes environment, this would scale the deployment
    if (config.environment === 'kubernetes') {
      try {
        const scaleCommand = `kubectl scale deployment zoom-bot-deployment --replicas=${containersNeeded} -n zoom-bots`;
        await execAsync(scaleCommand);
        console.log(`✅ Scaled Kubernetes deployment to ${containersNeeded} replicas`);
      } catch (error) {
        console.error('❌ Failed to scale Kubernetes deployment:', error.message);
        return res.status(500).json({ error: 'Failed to scale deployment' });
      }
    }

    res.json({
      success: true,
      meeting: {
        url: meetingUrl,
        totalBots: totalBots,
        containersNeeded: containersNeeded,
        botsPerContainer: config.botsPerContainer
      },
      deployment: {
        environment: config.environment,
        status: 'scaling',
        estimatedStartTime: '2-3 minutes'
      }
    });

  } catch (error) {
    console.error('❌ Error starting meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop all bots
app.post('/stop-meeting', async (req, res) => {
  try {
    console.log('🛑 Stopping all bot containers...');

    if (config.environment === 'kubernetes') {
      try {
        const scaleCommand = `kubectl scale deployment zoom-bot-deployment --replicas=0 -n zoom-bots`;
        await execAsync(scaleCommand);
        console.log('✅ Scaled Kubernetes deployment to 0 replicas');
      } catch (error) {
        console.error('❌ Failed to scale down Kubernetes deployment:', error.message);
        return res.status(500).json({ error: 'Failed to scale down deployment' });
      }
    }

    // Reset stats
    orchestratorStats.activeContainers = 0;
    orchestratorStats.activeBots = 0;
    orchestratorStats.lastUpdate = Date.now();

    res.json({
      success: true,
      message: 'All bot containers stopped',
      finalStats: orchestratorStats
    });

  } catch (error) {
    console.error('❌ Error stopping meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scale bots dynamically
app.post('/scale', async (req, res) => {
  try {
    const { targetBots } = req.body;
    
    if (!targetBots || targetBots < 0) {
      return res.status(400).json({ error: 'targetBots must be a positive number' });
    }

    const containersNeeded = Math.ceil(targetBots / config.botsPerContainer);
    
    if (containersNeeded > config.maxContainers) {
      return res.status(400).json({
        error: `Target ${targetBots} bots requires ${containersNeeded} containers, but max is ${config.maxContainers}`,
        maxBots: config.maxContainers * config.botsPerContainer
      });
    }

    console.log(`📈 Scaling to ${targetBots} bots (${containersNeeded} containers)`);

    if (config.environment === 'kubernetes') {
      try {
        const scaleCommand = `kubectl scale deployment zoom-bot-deployment --replicas=${containersNeeded} -n zoom-bots`;
        await execAsync(scaleCommand);
        console.log(`✅ Scaled Kubernetes deployment to ${containersNeeded} replicas`);
      } catch (error) {
        console.error('❌ Failed to scale Kubernetes deployment:', error.message);
        return res.status(500).json({ error: 'Failed to scale deployment' });
      }
    }

    orchestratorStats.totalContainers = containersNeeded;
    orchestratorStats.totalBots = targetBots;
    orchestratorStats.lastUpdate = Date.now();

    res.json({
      success: true,
      scaling: {
        targetBots: targetBots,
        containersNeeded: containersNeeded,
        currentContainers: orchestratorStats.activeContainers,
        status: containersNeeded > orchestratorStats.activeContainers ? 'scaling-up' : 'scaling-down'
      }
    });

  } catch (error) {
    console.error('❌ Error scaling bots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Kubernetes cluster info
app.get('/cluster-info', async (req, res) => {
  try {
    if (config.environment !== 'kubernetes') {
      return res.json({
        environment: config.environment,
        message: 'Not running in Kubernetes environment'
      });
    }

    const commands = {
      nodes: 'kubectl get nodes -o json',
      pods: 'kubectl get pods -n zoom-bots -o json',
      deployment: 'kubectl get deployment zoom-bot-deployment -n zoom-bots -o json'
    };

    const results = {};
    
    for (const [key, command] of Object.entries(commands)) {
      try {
        const { stdout } = await execAsync(command);
        results[key] = JSON.parse(stdout);
      } catch (error) {
        results[key] = { error: error.message };
      }
    }

    res.json({
      environment: 'kubernetes',
      cluster: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting cluster info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  const uptime = Math.round((Date.now() - orchestratorStats.startTime) / 1000);
  const successRate = orchestratorStats.totalBots > 0 
    ? (orchestratorStats.successfulBots / orchestratorStats.totalBots)
    : 0;

  const metrics = `
# HELP zoom_bots_total Total number of bots launched
# TYPE zoom_bots_total counter
zoom_bots_total ${orchestratorStats.totalBots}

# HELP zoom_bots_active Currently active bots
# TYPE zoom_bots_active gauge
zoom_bots_active ${orchestratorStats.activeBots}

# HELP zoom_bots_successful Successfully joined bots
# TYPE zoom_bots_successful counter
zoom_bots_successful ${orchestratorStats.successfulBots}

# HELP zoom_bots_failed Failed bots
# TYPE zoom_bots_failed counter
zoom_bots_failed ${orchestratorStats.failedBots}

# HELP zoom_containers_active Currently active containers
# TYPE zoom_containers_active gauge
zoom_containers_active ${orchestratorStats.activeContainers}

# HELP zoom_orchestrator_uptime Orchestrator uptime in seconds
# TYPE zoom_orchestrator_uptime counter
zoom_orchestrator_uptime ${uptime}

# HELP zoom_bots_success_rate Bot success rate (0-1)
# TYPE zoom_bots_success_rate gauge
zoom_bots_success_rate ${successRate}
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics.trim());
});

// Periodic stats update (simulated for development)
setInterval(() => {
  if (config.environment === 'development') {
    // Simulate some activity for development
    if (orchestratorStats.totalBots > 0) {
      orchestratorStats.activeBots = Math.min(
        orchestratorStats.totalBots,
        orchestratorStats.activeBots + Math.floor(Math.random() * 3)
      );
      orchestratorStats.activeContainers = Math.ceil(orchestratorStats.activeBots / config.botsPerContainer);
    }
  }
  orchestratorStats.lastUpdate = Date.now();
}, 10000); // Update every 10 seconds

// Start the orchestrator
app.listen(config.port, () => {
  console.log(`🚀 Zoom Bot Orchestrator running on port ${config.port}`);
  console.log(`📊 Dashboard: http://localhost:${config.port}/status`);
  console.log(`🔍 Health: http://localhost:${config.port}/health`);
  console.log(`📈 Metrics: http://localhost:${config.port}/metrics`);
  
  if (config.environment === 'kubernetes') {
    console.log('🎯 Running in Kubernetes mode - ready for production scaling');
  } else {
    console.log('🔧 Running in development mode - use for local testing');
  }
});

