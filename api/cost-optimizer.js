import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();

// Cost configuration and limits
const costConfig = {
  // Monthly cost limits (USD)
  maxMonthlyCost: parseFloat(process.env.MAX_MONTHLY_COST) || 50,
  warningThreshold: parseFloat(process.env.COST_WARNING_THRESHOLD) || 40,
  
  // Cost per resource per hour (estimated)
  costs: {
    gcp: {
      cpu: 0.031168,      // per vCPU per hour
      memory: 0.004237,   // per GB per hour
      storage: 0.000137   // per GB per hour
    },
    aws: {
      cpu: 0.0464,        // per vCPU per hour (t3.medium)
      memory: 0.0058,     // per GB per hour
      storage: 0.0001     // per GB per hour (EBS)
    },
    azure: {
      cpu: 0.0496,        // per vCPU per hour (B2s)
      memory: 0.0062,     // per GB per hour
      storage: 0.0005     // per GB per hour
    }
  },
  
  // Resource usage per bot
  botResources: {
    cpu: 0.1,           // 0.1 vCPU per bot
    memory: 0.128,      // 128MB per bot
    storage: 0.1        // 100MB per bot
  }
};

// Global cost tracking
let costStats = {
  currentMonthlyCost: 0,
  projectedMonthlyCost: 0,
  costByCloud: {
    gcp: 0,
    aws: 0,
    azure: 0
  },
  resourceUsage: {
    totalCPU: 0,
    totalMemory: 0,
    totalStorage: 0
  },
  activeBots: 0,
  lastUpdate: Date.now(),
  alerts: []
};

console.log('💰 Cost Optimizer Service Starting...');
console.log(`📊 Cost Configuration:`);
console.log(`   - Max monthly cost: $${costConfig.maxMonthlyCost}`);
console.log(`   - Warning threshold: $${costConfig.warningThreshold}`);

app.use(express.json());

// Calculate cost for a specific cloud and resource usage
function calculateCloudCost(cloud, cpuHours, memoryGBHours, storageGBHours) {
  const cloudCosts = costConfig.costs[cloud];
  if (!cloudCosts) return 0;
  
  return (
    cpuHours * cloudCosts.cpu +
    memoryGBHours * cloudCosts.memory +
    storageGBHours * cloudCosts.storage
  );
}

// Get current resource usage from Kubernetes
async function getCurrentResourceUsage() {
  try {
    const clouds = [
      { name: 'gcp', context: 'gke_zoom-bots_us-central1_zoom-cluster' },
      { name: 'aws', context: 'arn:aws:eks:us-west-2:account:cluster/zoom-bots-cluster' },
      { name: 'azure', context: 'zoom-bots-aks' }
    ];
    
    let totalUsage = {
      totalCPU: 0,
      totalMemory: 0,
      totalStorage: 0,
      activeBots: 0,
      byCloud: {}
    };
    
    for (const cloud of clouds) {
      try {
        // Switch context
        await execAsync(`kubectl config use-context ${cloud.context}`);
        
        // Get pod resource usage
        const { stdout: podsOutput } = await execAsync(
          `kubectl top pods -n zoom-bots --no-headers 2>/dev/null || echo ""`
        );
        
        // Get deployment info
        const { stdout: deploymentOutput } = await execAsync(
          `kubectl get deployment zoom-bot-deployment -n zoom-bots -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0"`
        );
        
        const replicas = parseInt(deploymentOutput) || 0;
        const botsInCloud = replicas * 6; // 6 bots per container
        
        // Calculate resource usage for this cloud
        const cloudUsage = {
          cpu: botsInCloud * costConfig.botResources.cpu,
          memory: botsInCloud * costConfig.botResources.memory,
          storage: botsInCloud * costConfig.botResources.storage,
          bots: botsInCloud
        };
        
        totalUsage.totalCPU += cloudUsage.cpu;
        totalUsage.totalMemory += cloudUsage.memory;
        totalUsage.totalStorage += cloudUsage.storage;
        totalUsage.activeBots += cloudUsage.bots;
        totalUsage.byCloud[cloud.name] = cloudUsage;
        
      } catch (error) {
        console.log(`⚠️  Could not get usage for ${cloud.name}: ${error.message}`);
        totalUsage.byCloud[cloud.name] = { cpu: 0, memory: 0, storage: 0, bots: 0 };
      }
    }
    
    return totalUsage;
    
  } catch (error) {
    console.error('❌ Error getting resource usage:', error.message);
    return null;
  }
}

// Calculate current and projected costs
async function calculateCosts() {
  const usage = await getCurrentResourceUsage();
  if (!usage) return;
  
  const hoursInMonth = 24 * 30; // 720 hours
  let totalMonthlyCost = 0;
  
  // Calculate cost for each cloud
  for (const [cloudName, cloudUsage] of Object.entries(usage.byCloud)) {
    const monthlyCost = calculateCloudCost(
      cloudName,
      cloudUsage.cpu * hoursInMonth,
      cloudUsage.memory * hoursInMonth,
      cloudUsage.storage * hoursInMonth
    );
    
    costStats.costByCloud[cloudName] = monthlyCost;
    totalMonthlyCost += monthlyCost;
  }
  
  // Update global stats
  costStats.projectedMonthlyCost = totalMonthlyCost;
  costStats.resourceUsage = {
    totalCPU: usage.totalCPU,
    totalMemory: usage.totalMemory,
    totalStorage: usage.totalStorage
  };
  costStats.activeBots = usage.activeBots;
  costStats.lastUpdate = Date.now();
  
  // Check for cost alerts
  checkCostAlerts();
}

// Check for cost alerts and take action
function checkCostAlerts() {
  const projectedCost = costStats.projectedMonthlyCost;
  
  // Clear old alerts
  costStats.alerts = costStats.alerts.filter(alert => 
    Date.now() - alert.timestamp < 3600000 // Keep alerts for 1 hour
  );
  
  // Warning threshold alert
  if (projectedCost > costConfig.warningThreshold && projectedCost <= costConfig.maxMonthlyCost) {
    const alert = {
      level: 'warning',
      message: `Projected monthly cost ($${projectedCost.toFixed(2)}) exceeds warning threshold ($${costConfig.warningThreshold})`,
      timestamp: Date.now(),
      action: 'monitor'
    };
    
    costStats.alerts.push(alert);
    console.log(`⚠️  ${alert.message}`);
  }
  
  // Critical threshold alert with auto-scaling
  if (projectedCost > costConfig.maxMonthlyCost) {
    const alert = {
      level: 'critical',
      message: `Projected monthly cost ($${projectedCost.toFixed(2)}) exceeds maximum ($${costConfig.maxMonthlyCost})`,
      timestamp: Date.now(),
      action: 'auto_scale_down'
    };
    
    costStats.alerts.push(alert);
    console.log(`🚨 ${alert.message}`);
    
    // Auto-scale down to reduce costs
    autoScaleDown();
  }
}

// Auto-scale down to reduce costs
async function autoScaleDown() {
  try {
    console.log('🔄 Auto-scaling down to reduce costs...');
    
    const targetCost = costConfig.maxMonthlyCost * 0.8; // Scale to 80% of max
    const currentCostPerBot = costStats.projectedMonthlyCost / costStats.activeBots;
    const targetBots = Math.floor(targetCost / currentCostPerBot);
    
    console.log(`📉 Scaling down from ${costStats.activeBots} to ${targetBots} bots`);
    
    // Use the scaling script
    await execAsync(`./scripts/scale-bots.sh ${targetBots}`);
    
    // Log the action
    const alert = {
      level: 'info',
      message: `Auto-scaled down to ${targetBots} bots to reduce costs`,
      timestamp: Date.now(),
      action: 'completed'
    };
    
    costStats.alerts.push(alert);
    
  } catch (error) {
    console.error('❌ Error during auto-scaling:', error.message);
  }
}

// API Endpoints

// Get current cost status
app.get('/cost-status', (req, res) => {
  const utilizationPercent = (costStats.projectedMonthlyCost / costConfig.maxMonthlyCost * 100).toFixed(1);
  
  res.json({
    current: {
      projectedMonthlyCost: costStats.projectedMonthlyCost,
      utilizationPercent: `${utilizationPercent}%`,
      activeBots: costStats.activeBots,
      costPerBot: costStats.activeBots > 0 ? (costStats.projectedMonthlyCost / costStats.activeBots).toFixed(4) : 0
    },
    limits: {
      maxMonthlyCost: costConfig.maxMonthlyCost,
      warningThreshold: costConfig.warningThreshold,
      remainingBudget: Math.max(0, costConfig.maxMonthlyCost - costStats.projectedMonthlyCost)
    },
    breakdown: {
      byCloud: costStats.costByCloud,
      resources: costStats.resourceUsage
    },
    alerts: costStats.alerts,
    lastUpdate: new Date(costStats.lastUpdate).toISOString()
  });
});

// Update cost limits
app.post('/update-limits', (req, res) => {
  try {
    const { maxMonthlyCost, warningThreshold } = req.body;
    
    if (maxMonthlyCost) {
      costConfig.maxMonthlyCost = parseFloat(maxMonthlyCost);
    }
    
    if (warningThreshold) {
      costConfig.warningThreshold = parseFloat(warningThreshold);
    }
    
    console.log(`💰 Updated cost limits: Max: $${costConfig.maxMonthlyCost}, Warning: $${costConfig.warningThreshold}`);
    
    res.json({
      success: true,
      newLimits: {
        maxMonthlyCost: costConfig.maxMonthlyCost,
        warningThreshold: costConfig.warningThreshold
      }
    });
    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get cost projection for different bot counts
app.post('/cost-projection', (req, res) => {
  try {
    const { targetBots } = req.body;
    
    if (!targetBots || targetBots < 0) {
      return res.status(400).json({ error: 'targetBots must be a positive number' });
    }
    
    // Calculate resource requirements
    const totalCPU = targetBots * costConfig.botResources.cpu;
    const totalMemory = targetBots * costConfig.botResources.memory;
    const totalStorage = targetBots * costConfig.botResources.storage;
    
    // Distribute across clouds (40% GCP, 35% AWS, 25% Azure)
    const distribution = {
      gcp: Math.ceil(targetBots * 0.4),
      aws: Math.ceil(targetBots * 0.35),
      azure: Math.ceil(targetBots * 0.25)
    };
    
    const hoursInMonth = 24 * 30;
    let projectedCosts = {};
    let totalProjectedCost = 0;
    
    // Calculate cost for each cloud
    for (const [cloud, bots] of Object.entries(distribution)) {
      const cloudCPU = bots * costConfig.botResources.cpu;
      const cloudMemory = bots * costConfig.botResources.memory;
      const cloudStorage = bots * costConfig.botResources.storage;
      
      const monthlyCost = calculateCloudCost(
        cloud,
        cloudCPU * hoursInMonth,
        cloudMemory * hoursInMonth,
        cloudStorage * hoursInMonth
      );
      
      projectedCosts[cloud] = {
        bots: bots,
        monthlyCost: monthlyCost,
        resources: {
          cpu: cloudCPU,
          memory: cloudMemory,
          storage: cloudStorage
        }
      };
      
      totalProjectedCost += monthlyCost;
    }
    
    // Check if within budget
    const withinBudget = totalProjectedCost <= costConfig.maxMonthlyCost;
    const utilizationPercent = (totalProjectedCost / costConfig.maxMonthlyCost * 100).toFixed(1);
    
    res.json({
      projection: {
        targetBots: targetBots,
        totalProjectedCost: totalProjectedCost,
        costPerBot: (totalProjectedCost / targetBots).toFixed(4),
        utilizationPercent: `${utilizationPercent}%`,
        withinBudget: withinBudget
      },
      distribution: projectedCosts,
      totalResources: {
        cpu: totalCPU,
        memory: totalMemory,
        storage: totalStorage
      },
      recommendation: withinBudget 
        ? 'Projection is within budget limits'
        : `Exceeds budget by $${(totalProjectedCost - costConfig.maxMonthlyCost).toFixed(2)}`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force cost calculation update
app.post('/refresh-costs', async (req, res) => {
  try {
    await calculateCosts();
    res.json({
      success: true,
      message: 'Cost calculations refreshed',
      currentStats: costStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cost optimization recommendations
app.get('/recommendations', (req, res) => {
  const recommendations = [];
  
  // High cost per bot
  const costPerBot = costStats.activeBots > 0 ? costStats.projectedMonthlyCost / costStats.activeBots : 0;
  if (costPerBot > 0.05) { // $0.05 per bot per month
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      message: `Cost per bot ($${costPerBot.toFixed(4)}) is high. Consider optimizing resource allocation.`,
      action: 'Review container resource limits and bot efficiency'
    });
  }
  
  // Uneven cloud distribution
  const cloudCosts = Object.values(costStats.costByCloud);
  const maxCloudCost = Math.max(...cloudCosts);
  const minCloudCost = Math.min(...cloudCosts.filter(cost => cost > 0));
  
  if (maxCloudCost > minCloudCost * 2) {
    recommendations.push({
      type: 'distribution',
      priority: 'low',
      message: 'Uneven cost distribution across clouds. Consider rebalancing.',
      action: 'Redistribute bots to utilize free tiers more effectively'
    });
  }
  
  // Approaching budget limit
  const utilizationPercent = costStats.projectedMonthlyCost / costConfig.maxMonthlyCost;
  if (utilizationPercent > 0.8) {
    recommendations.push({
      type: 'budget',
      priority: 'high',
      message: `Using ${(utilizationPercent * 100).toFixed(1)}% of monthly budget`,
      action: 'Consider increasing budget or reducing bot count'
    });
  }
  
  // No active alerts - all good
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'status',
      priority: 'info',
      message: 'Cost optimization is performing well',
      action: 'Continue monitoring'
    });
  }
  
  res.json({
    recommendations: recommendations,
    summary: {
      totalRecommendations: recommendations.length,
      highPriority: recommendations.filter(r => r.priority === 'high').length,
      mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
      lowPriority: recommendations.filter(r => r.priority === 'low').length
    }
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  const metrics = `
# HELP zoom_cost_projected_monthly Projected monthly cost in USD
# TYPE zoom_cost_projected_monthly gauge
zoom_cost_projected_monthly ${costStats.projectedMonthlyCost}

# HELP zoom_cost_budget_utilization Budget utilization percentage (0-1)
# TYPE zoom_cost_budget_utilization gauge
zoom_cost_budget_utilization ${costStats.projectedMonthlyCost / costConfig.maxMonthlyCost}

# HELP zoom_cost_per_bot Cost per bot per month in USD
# TYPE zoom_cost_per_bot gauge
zoom_cost_per_bot ${costStats.activeBots > 0 ? costStats.projectedMonthlyCost / costStats.activeBots : 0}

# HELP zoom_cost_alerts_active Number of active cost alerts
# TYPE zoom_cost_alerts_active gauge
zoom_cost_alerts_active ${costStats.alerts.length}

# HELP zoom_resource_cpu_total Total CPU usage in vCPUs
# TYPE zoom_resource_cpu_total gauge
zoom_resource_cpu_total ${costStats.resourceUsage.totalCPU}

# HELP zoom_resource_memory_total Total memory usage in GB
# TYPE zoom_resource_memory_total gauge
zoom_resource_memory_total ${costStats.resourceUsage.totalMemory}
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics.trim());
});

// Periodic cost calculation
setInterval(async () => {
  await calculateCosts();
}, 300000); // Every 5 minutes

// Initial cost calculation
calculateCosts();

// Start the cost optimizer service
const PORT = process.env.COST_OPTIMIZER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`💰 Cost Optimizer running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/cost-status`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`💡 Recommendations: http://localhost:${PORT}/recommendations`);
});

























