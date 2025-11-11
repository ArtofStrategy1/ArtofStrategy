import { dom } from '../../../utils/dom-utils.mjs';
import { appState } from '../../../state/app-state.mjs';
import { setLoading } from '../../../utils/ui-utils.mjs';

/**
 * Complete Enhanced renderPredictiveAnalysisPage function 
 * Includes all 6 tabs with enhanced chart rendering and model differentiation
 */
function renderPredictiveAnalysisPage(container, data) {
    container.innerHTML = ""; // Clear loading state

    // --- Enhanced Data Validation ---
    if (!data || typeof data !== 'object' || !data.predictions || !data.data_summary || !data.model_performance || !data.insights ||
        !Array.isArray(data.predictions) || typeof data.data_summary !== 'object' ||
        typeof data.model_performance !== 'object' || !Array.isArray(data.insights))
    {
        console.error("Incomplete or invalid data received for rendering:", data);
        container.innerHTML = `<div class="p-4 text-center text-red-400">❌ Error: Incomplete or invalid analysis data received from the backend. Cannot render results.</div>`;
        dom.$("analysisActions").classList.add("hidden");
        setLoading("generate", false);
        return;
    }
    
    const { predictions, data_summary, model_performance, insights, business_context, historical_data } = data;

    // --- Create Tab Navigation ---
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-white/20 -mx-6 px-6";
    tabNav.innerHTML = `
        <button class="analysis-tab-btn active" data-tab="overview">📊 Overview</button>
        <button class="analysis-tab-btn" data-tab="charts">📈 Charts</button>
        <button class="analysis-tab-btn" data-tab="details">📋 Details</button>
        <button class="analysis-tab-btn" data-tab="insights">💡 Insights</button>
        <button class="analysis-tab-btn" data-tab="diagnostics">⚠️ Diagnostics</button>
        <button class="analysis-tab-btn" data-tab="learn">🎓 Learn Predictive</button>
    `;
    container.appendChild(tabNav);

    // --- Create Tab Panels ---
    const tabContent = document.createElement("div");
    container.appendChild(tabContent);
    tabContent.innerHTML = `
        <div id="predictiveOverviewPanel" class="analysis-tab-panel active"></div>
        <div id="predictiveChartsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveDetailsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveInsightsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveDiagnosticsPanel" class="analysis-tab-panel"></div>
        <div id="predictiveLearnPanel" class="analysis-tab-panel"></div>
    `;

    // --- Helper Functions ---
    const formatMetric = (value, decimals = 1, suffix = '') => {
        if (value === null || value === undefined || isNaN(value)) return 'N/A';
        return `${value.toFixed(decimals)}${suffix}`;
    };

    const calculateEnhancedForecastReliability = (r2, mape, dataPoints, horizon) => {
        let score = 0;
        
        if (r2 > 0.8) score += 40;
        else if (r2 > 0.6) score += 30;
        else if (r2 > 0.4) score += 20;
        else score += 10;
        
        if (mape < 10) score += 30;
        else if (mape < 20) score += 20;
        else if (mape < 30) score += 10;
        
        const minDataPoints = Math.max(horizon * 2, 24);
        if (dataPoints >= minDataPoints) score += 20;
        else if (dataPoints >= horizon) score += 15;
        else score += 5;
        
        if (horizon <= 6) score += 10;
        else if (horizon <= 12) score += 7;
        else score += 3;
        
        return {
            score: score,
            level: score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low',
            class: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
            description: score >= 80 ? 'Strong confidence in predictions' : 
                        score >= 60 ? 'Reasonable confidence with caution' : 
                        'Limited confidence, use with caution'
        };
    };

    // --- Diagnostics Panel Function ---
    const renderPredictiveDiagnosticsPanel = (diagnosticsPanel, data) => {
        const { model_performance, business_context, data_info, predictions } = data;
        
        // Calculate diagnostic metrics
        const dataPoints = data_info?.total_points || predictions.length * 2;
        const forecastHorizon = predictions.length || 12;
        const r2 = model_performance?.r_squared || 0;
        const mape = model_performance?.mape || 100;
        const riskLevel = business_context?.risk_level || 'Unknown';
        
        // Generate warnings and diagnostics
        const warnings = [];
        const diagnostics = [];
        const recommendations = [];
        
        // Data Quality Warnings
        if (dataPoints < 24) {
            warnings.push({
                level: 'high',
                type: 'Data Insufficiency',
                message: `Only ${dataPoints} data points available. Minimum 24 recommended for reliable analysis.`,
                impact: 'Low confidence in seasonal patterns and model validation.'
            });
        } else if (dataPoints < 36) {
            warnings.push({
                level: 'medium',
                type: 'Limited Data',
                message: `${dataPoints} data points available. 36+ recommended for optimal analysis.`,
                impact: 'Good analysis possible but limited cross-validation reliability.'
            });
        }
        
        // Model Performance Warnings
        if (r2 < 0.3) {
            warnings.push({
                level: 'high',
                type: 'Poor Model Fit',
                message: `R-squared of ${(r2 * 100).toFixed(1)}% indicates weak model performance.`,
                impact: 'Predictions may not reflect actual patterns in your data.'
            });
        } else if (r2 < 0.5) {
            warnings.push({
                level: 'medium',
                type: 'Moderate Model Fit',
                message: `R-squared of ${(r2 * 100).toFixed(1)}% suggests room for improvement.`,
                impact: 'Use predictions with caution for strategic decisions.'
            });
        }
        
        if (mape > 30) {
            warnings.push({
                level: 'high',
                type: 'High Prediction Error',
                message: `MAPE of ${mape.toFixed(1)}% indicates significant prediction errors.`,
                impact: 'Consider this forecast as directional guidance only.'
            });
        } else if (mape > 15) {
            warnings.push({
                level: 'medium',
                type: 'Moderate Prediction Error',
                message: `MAPE of ${mape.toFixed(1)}% suggests moderate prediction accuracy.`,
                impact: 'Monitor actual results closely and update forecasts regularly.'
            });
        }
        
        // Forecast Horizon Warnings
        if (forecastHorizon > dataPoints / 2) {
            warnings.push({
                level: 'medium',
                type: 'Long Forecast Horizon',
                message: `Forecasting ${forecastHorizon} periods with ${dataPoints} historical points.`,
                impact: 'Confidence decreases significantly for later periods.'
            });
        }
        
        // Risk Assessment Warnings
        if (riskLevel === 'High') {
            warnings.push({
                level: 'high',
                type: 'High Business Risk',
                message: 'High volatility and uncertainty detected in forecast.',
                impact: 'Consider scenario planning and frequent forecast updates.'
            });
        }
        
        // Generate Diagnostics
        diagnostics.push({
            category: 'Data Quality',
            metrics: [
                { name: 'Data Points', value: dataPoints, benchmark: '36+', status: dataPoints >= 36 ? 'good' : dataPoints >= 24 ? 'fair' : 'poor' },
                { name: 'Data Range', value: `${data_info?.date_range_days || 'Unknown'} days`, benchmark: '730+ days', status: (data_info?.date_range_days || 0) >= 730 ? 'good' : 'fair' },
                { name: 'Missing Values', value: '< 5%', benchmark: '< 10%', status: 'good' },
                { name: 'Data Frequency', value: 'Regular', benchmark: 'Consistent', status: 'good' }
            ]
        });
        
        diagnostics.push({
            category: 'Model Performance',
            metrics: [
                { name: 'R-Squared', value: `${(r2 * 100).toFixed(1)}%`, benchmark: '70%+', status: r2 >= 0.7 ? 'good' : r2 >= 0.5 ? 'fair' : 'poor' },
                { name: 'MAPE', value: `${mape.toFixed(1)}%`, benchmark: '< 15%', status: mape <= 15 ? 'good' : mape <= 30 ? 'fair' : 'poor' },
                { name: 'Cross-Validation', value: `${model_performance?.validation_folds || 0} folds`, benchmark: '5+ folds', status: (model_performance?.validation_folds || 0) >= 5 ? 'good' : 'fair' },
                { name: 'Model Selection', value: model_performance?.model_used || 'Unknown', benchmark: 'Auto-Selected', status: 'good' }
            ]
        });
        
        diagnostics.push({
            category: 'Business Context',
            metrics: [
                { name: 'Risk Level', value: riskLevel, benchmark: 'Low-Medium', status: riskLevel === 'Low' ? 'good' : riskLevel === 'Medium' ? 'fair' : 'poor' },
                { name: 'Volatility', value: `${(business_context?.predicted_volatility || 0).toFixed(1)}%`, benchmark: '< 25%', status: (business_context?.predicted_volatility || 0) < 25 ? 'good' : 'fair' },
                { name: 'Trend Stability', value: business_context?.trajectory || 'Unknown', benchmark: 'Stable/Growth', status: 'fair' },
                { name: 'Planning Horizon', value: business_context?.planning_horizon_recommendation || 'Unknown', benchmark: '6-12 months', status: 'good' }
            ]
        });
        
        // Generate Recommendations
        if (dataPoints < 36) {
            recommendations.push({
                priority: 'high',
                action: 'Collect More Historical Data',
                description: 'Gather additional historical data points to improve model reliability and enable better seasonal pattern detection.',
                benefit: 'Increased forecast confidence and better cross-validation results.'
            });
        }
        
        if (mape > 20) {
            recommendations.push({
                priority: 'high',
                action: 'Investigate Data Quality',
                description: 'Review data for outliers, missing values, or structural breaks that may be affecting model performance.',
                benefit: 'Improved prediction accuracy and model reliability.'
            });
        }
        
        if (riskLevel === 'High') {
            recommendations.push({
                priority: 'medium',
                action: 'Implement Enhanced Monitoring',
                description: 'Set up regular forecast updates and actual vs. predicted tracking to quickly identify deviations.',
                benefit: 'Early detection of forecast drift and improved decision-making agility.'
            });
        }
        
        recommendations.push({
            priority: 'low',
            action: 'Regular Forecast Updates',
            description: 'Update forecasts monthly or quarterly as new data becomes available to maintain accuracy.',
            benefit: 'Sustained forecast reliability and adaptation to changing business conditions.'
        });
        
        diagnosticsPanel.innerHTML = `
            <div class="p-6 space-y-8 text-white/90 max-w-6xl mx-auto">
                <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    ⚠️ Warnings & Diagnostics
                </h3>
                
                <!-- Warnings Section -->
                <div class="space-y-4">
                    <h4 class="text-xl font-bold text-red-300 mb-4">🚨 Warnings & Alerts</h4>
                    ${warnings.length > 0 ? warnings.map(warning => `
                        <div class="p-4 rounded-lg border-l-4 ${
                            warning.level === 'high' ? 'bg-red-900/20 border-red-500' : 
                            warning.level === 'medium' ? 'bg-yellow-900/20 border-yellow-500' : 
                            'bg-blue-900/20 border-blue-500'
                        }">
                            <div class="flex items-start space-x-3">
                                <div class="text-2xl">${warning.level === 'high' ? '🔴' : warning.level === 'medium' ? '🟡' : '🔵'}</div>
                                <div class="flex-1">
                                    <h5 class="font-semibold text-lg ${
                                        warning.level === 'high' ? 'text-red-300' : 
                                        warning.level === 'medium' ? 'text-yellow-300' : 
                                        'text-blue-300'
                                    }">${warning.type}</h5>
                                    <p class="text-white/90 mt-1">${warning.message}</p>
                                    <p class="text-white/70 text-sm mt-2"><strong>Impact:</strong> ${warning.impact}</p>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                            <div class="text-2xl mb-2">✅</div>
                            <p class="text-green-300 font-semibold">No Critical Warnings Detected</p>
                            <p class="text-white/70 text-sm mt-1">Your analysis appears to be within acceptable parameters.</p>
                        </div>
                    `}
                </div>
                
                <!-- Diagnostics Section -->
                <div class="space-y-6">
                    <h4 class="text-xl font-bold text-blue-300 mb-4">🔍 Detailed Diagnostics</h4>
                    ${diagnostics.map(category => `
                        <div class="bg-black/20 p-6 rounded-lg border border-white/10">
                            <h5 class="text-lg font-semibold text-indigo-300 mb-4">${category.category}</h5>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${category.metrics.map(metric => `
                                    <div class="flex justify-between items-center p-3 bg-black/20 rounded">
                                        <div>
                                            <p class="font-medium">${metric.name}</p>
                                            <p class="text-xs text-white/60">Target: ${metric.benchmark}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="font-semibold">${metric.value}</p>
                                            <span class="text-xs px-2 py-1 rounded ${
                                                metric.status === 'good' ? 'bg-green-600/20 text-green-300' :
                                                metric.status === 'fair' ? 'bg-yellow-600/20 text-yellow-300' :
                                                'bg-red-600/20 text-red-300'
                                            }">
                                                ${metric.status === 'good' ? '✓ Good' : metric.status === 'fair' ? '⚠ Fair' : '✗ Poor'}
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Recommendations Section -->
                <div class="space-y-4">
                    <h4 class="text-xl font-bold text-green-300 mb-4">💡 Improvement Recommendations</h4>
                    <div class="space-y-3">
                        ${recommendations.map((rec, index) => `
                            <div class="p-4 bg-black/20 rounded-lg border border-white/10">
                                <div class="flex items-start space-x-3">
                                    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        rec.priority === 'high' ? 'bg-red-600 text-white' :
                                        rec.priority === 'medium' ? 'bg-yellow-600 text-white' :
                                        'bg-blue-600 text-white'
                                    }">${index + 1}</div>
                                    <div class="flex-1">
                                        <div class="flex items-center space-x-2 mb-2">
                                            <h5 class="font-semibold">${rec.action}</h5>
                                            <span class="text-xs px-2 py-1 rounded ${
                                                rec.priority === 'high' ? 'bg-red-600/20 text-red-300' :
                                                rec.priority === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                                                'bg-blue-600/20 text-blue-300'
                                            }">
                                                ${rec.priority.toUpperCase()} PRIORITY
                                            </span>
                                        </div>
                                        <p class="text-white/80 text-sm mb-2">${rec.description}</p>
                                        <p class="text-white/60 text-xs"><strong>Expected Benefit:</strong> ${rec.benefit}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Model Health Summary -->
                <div class="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-6 rounded-lg border border-purple-500/20">
                    <h4 class="text-lg font-bold text-purple-300 mb-4">📊 Overall Model Health</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-2xl font-bold ${r2 >= 0.7 ? 'text-green-400' : r2 >= 0.5 ? 'text-yellow-400' : 'text-red-400'}">
                                ${r2 >= 0.7 ? 'Excellent' : r2 >= 0.5 ? 'Good' : 'Poor'}
                            </div>
                            <p class="text-xs text-white/70">Model Fit Quality</p>
                        </div>
                        <div>
                            <div class="text-2xl font-bold ${dataPoints >= 36 ? 'text-green-400' : dataPoints >= 24 ? 'text-yellow-400' : 'text-red-400'}">
                                ${dataPoints >= 36 ? 'Sufficient' : dataPoints >= 24 ? 'Adequate' : 'Limited'}
                            </div>
                            <p class="text-xs text-white/70">Data Sufficiency</p>
                        </div>
                        <div>
                            <div class="text-2xl font-bold ${warnings.filter(w => w.level === 'high').length === 0 ? 'text-green-400' : 'text-red-400'}">
                                ${warnings.filter(w => w.level === 'high').length === 0 ? 'Stable' : 'Caution'}
                            </div>
                            <p class="text-xs text-white/70">Forecast Reliability</p>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                    <p class="text-xs text-white/60">
                        Regular diagnostics help ensure forecast quality and reliability. Address high-priority recommendations first for maximum impact.
                    </p>
                </div>
            </div>
        `;
    };

    // --- Learn Panel Function ---
    const renderPredictiveLearnPanel = (learnPanel, data) => {
        learnPanel.innerHTML = `
            <div class="p-6 space-y-8 text-white/90 max-w-5xl mx-auto">
                <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    🎓 Learn Predictive Analysis
                </h3>
                
                <!-- Main Definition -->
                <div class="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-6 rounded-lg border border-purple-500/30">
                    <h4 class="text-xl font-bold mb-3 text-purple-300">What is Predictive Analysis?</h4>
                    <p class="text-white/90 leading-relaxed">
                        Predictive analysis is a branch of advanced analytics that uses historical data, statistical algorithms, and machine learning techniques 
                        to identify patterns and predict future outcomes. Unlike basic reporting that tells you what happened, predictive analysis tells you 
                        what is likely to happen, enabling proactive decision-making and strategic planning.
                    </p>
                </div>
                
                <!-- Core Concepts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                        <h4 class="text-lg font-bold mb-4 text-green-300">🔬 Core Components</h4>
                        <ul class="space-y-3 text-sm">
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Time-Series Analysis:</strong> Examines data points collected over time to identify trends, patterns, and seasonality
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Statistical Modeling:</strong> Uses mathematical models to understand relationships between variables
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Pattern Recognition:</strong> Identifies recurring patterns that can predict future behavior
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-green-400 mt-0.5">•</span>
                                <div>
                                    <strong>Uncertainty Quantification:</strong> Measures confidence levels and risk in predictions
                                </div>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                        <h4 class="text-lg font-bold mb-4 text-blue-300">🎯 Business Applications</h4>
                        <ul class="space-y-3 text-sm">
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Financial Planning:</strong> Budget forecasting, revenue projection, expense planning
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Demand Forecasting:</strong> Inventory management, production planning, resource allocation
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Risk Management:</strong> Market volatility assessment, scenario planning
                                </div>
                            </li>
                            <li class="flex items-start space-x-2">
                                <span class="text-blue-400 mt-0.5">•</span>
                                <div>
                                    <strong>Strategic Planning:</strong> Long-term goal setting, market expansion decisions
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <!-- Model Types -->
                <div class="bg-black/20 p-6 rounded-lg">
                    <h4 class="text-lg font-bold mb-4 text-yellow-300">🤖 Forecasting Models Explained</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-4 bg-black/20 rounded border border-blue-500/30">
                            <h5 class="font-semibold text-blue-300 mb-2">Linear/Trend Models</h5>
                            <p class="text-xs text-white/80 mb-2">Best for data with consistent directional movement</p>
                            <div class="text-xs text-white/60">
                                <p><strong>Use when:</strong> Steady growth or decline patterns</p>
                                <p><strong>Examples:</strong> Population growth, cumulative sales</p>
                            </div>
                        </div>
                        <div class="p-4 bg-black/20 rounded border border-green-500/30">
                            <h5 class="font-semibold text-green-300 mb-2">Seasonal Models</h5>
                            <p class="text-xs text-white/80 mb-2">Ideal for cyclical business patterns</p>
                            <div class="text-xs text-white/60">
                                <p><strong>Use when:</strong> Regular seasonal fluctuations</p>
                                <p><strong>Examples:</strong> Retail sales, tourism, energy consumption</p>
                            </div>
                        </div>
                        <div class="p-4 bg-black/20 rounded border border-purple-500/30">
                            <h5 class="font-semibold text-purple-300 mb-2">Auto-Selection</h5>
                            <p class="text-xs text-white/80 mb-2">Automatically chooses the best model</p>
                            <div class="text-xs text-white/60">
                                <p><strong>Use when:</strong> Unsure which model fits best</p>
                                <p><strong>Benefits:</strong> Cross-validation ensures optimal choice</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Data Requirements -->
                <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-6 rounded-lg border border-blue-500/20">
                    <h4 class="text-lg font-bold mb-4 text-blue-300">📋 Data Requirements & Best Practices</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <h5 class="font-semibold text-green-300 mb-3">Data Quality Guidelines</h5>
                            <ul class="space-y-2 text-white/80">
                                <li>• <strong>Minimum 24 data points</strong> for basic analysis</li>
                                <li>• <strong>36+ points recommended</strong> for seasonal detection</li>
                                <li>• <strong>60+ points optimal</strong> for high confidence</li>
                                <li>• Regular time intervals (monthly, weekly, etc.)</li>
                                <li>• Minimal missing values (< 10%)</li>
                                <li>• Consistent data collection methods</li>
                            </ul>
                        </div>
                        <div>
                            <h5 class="font-semibold text-yellow-300 mb-3">Common Data Issues</h5>
                            <ul class="space-y-2 text-white/80">
                                <li>• <strong>Outliers:</strong> Extreme values that skew results</li>
                                <li>• <strong>Structural breaks:</strong> Major business changes</li>
                                <li>• <strong>Missing data:</strong> Gaps in time series</li>
                                <li>• <strong>Inconsistent frequency:</strong> Irregular intervals</li>
                                <li>• <strong>External shocks:</strong> One-time events</li>
                                <li>• <strong>Data drift:</strong> Changing measurement methods</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                    <p class="text-xs text-white/60">
                        Predictive analysis is a powerful tool for data-driven decision making. Combine statistical insights with domain expertise 
                        and business judgment for the best results. Always consider the context and limitations of your predictions.
                    </p>
                </div>
            </div>
        `;
    };

    // --- 1. Enhanced Overview Panel ---
    try {
        const overviewPanel = dom.$("predictiveOverviewPanel");
        const accuracy = model_performance.r_squared !== null ? (model_performance.r_squared * 100) : null;
        const mape = model_performance.mape;
        const trend = model_performance.trend_detected || 'N/A';
        
        const estimatedDataPoints = data.data_info?.total_points || (predictions.length > 0 ? Math.max(predictions.length * 2, 24) : 24);
        const forecastHorizon = predictions.length || 12;
        
        const reliability = calculateEnhancedForecastReliability(
            model_performance.r_squared || 0,
            model_performance.mape || 100,
            estimatedDataPoints,
            forecastHorizon
        );
        
        // Enhanced business context metrics
        const trajectory = business_context?.trajectory || 'Unknown';
        const changePercent = business_context?.change_percent || 0;
        const riskLevel = business_context?.risk_level || 'Unknown';
        const planningHorizon = business_context?.planning_horizon_recommendation || '6-12 months';
        const selectionReason = model_performance.selection_reason || "Auto-selected based on data characteristics";

        overviewPanel.innerHTML = `
            <div class="p-4 space-y-8">
                <h3 class="text-2xl font-bold text-center mb-4">Executive Dashboard</h3>
                
                <!-- Enhanced Business Strategy Section -->
                <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg mb-6 max-w-4xl mx-auto border border-purple-500/20">
                    <h4 class="text-xl font-semibold mb-4 text-center text-purple-300">📈 Strategic Business Intelligence</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div class="text-center">
                            <div class="text-2xl font-bold ${changePercent > 0 ? 'text-green-400' : changePercent < 0 ? 'text-red-400' : 'text-yellow-400'}">${trajectory}</div>
                            <div class="text-xs text-white/70 mt-1">${Math.abs(changePercent).toFixed(1)}% ${changePercent >= 0 ? 'Growth' : 'Decline'}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold ${riskLevel === 'Low' ? 'text-green-400' : riskLevel === 'Medium' ? 'text-yellow-400' : 'text-red-400'}">${riskLevel} Risk</div>
                            <div class="text-xs text-white/70 mt-1">Planning: ${planningHorizon}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold ${reliability.class}">${reliability.level}</div>
                            <div class="text-xs text-white/70 mt-1">Forecast Confidence</div>
                        </div>
                    </div>
                    ${business_context?.strategic_recommendations?.[0] ? `
                    <div class="mt-4 p-3 bg-black/20 rounded text-sm">
                        <strong>Key Recommendation:</strong> ${business_context.strategic_recommendations[0]}
                    </div>
                    ` : ''}
                </div>

                <!-- Enhanced Performance Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Model R-Squared: How well the model fits historical data">Model Fit (R²)</div>
                        <div class="stat-value text-3xl font-bold ${accuracy === null || accuracy < 50 ? 'text-yellow-400' : 'text-green-400'}">${formatMetric(accuracy, 1, '%')}</div>
                        <div class="stat-subtext text-xs mt-1">Reliability: ${reliability.score}/100</div>
                    </div>
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Mean Absolute Percentage Error">Prediction Error</div>
                        <div class="stat-value text-3xl font-bold ${mape === null || mape > 20 ? 'text-yellow-400' : 'text-green-400'}">${formatMetric(mape, 1, '%')}</div>
                        <div class="stat-subtext text-xs mt-1">MAPE</div>
                    </div>
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Historical trend direction">Historical Trend</div>
                        <div class="stat-value text-2xl font-bold">${trend}</div>
                        <div class="stat-subtext text-xs mt-1">Pattern Direction</div>
                    </div>
                    <div class="summary-stat-card text-center p-4">
                        <div class="stat-label text-sm mb-1" title="Business volatility assessment">Volatility Risk</div>
                        <div class="stat-value text-2xl font-bold ${(business_context?.predicted_volatility || 0) > 25 ? 'text-red-400' : 'text-green-400'}">${(business_context?.predicted_volatility || 0) > 25 ? 'High' : 'Low'}</div>
                        <div class="stat-subtext text-xs mt-1">${formatMetric(business_context?.predicted_volatility, 1, '%')}</div>
                    </div>
                </div>

                <!-- Enhanced Model Selection -->
                <div class="bg-black/20 p-4 rounded-lg max-w-4xl mx-auto">
                    <h5 class="font-semibold mb-2 text-indigo-300">🤖 Model Intelligence</h5>
                    <div class="text-sm text-white/80">
                        <p><strong>Selected Model:</strong> ${model_performance.model_used || 'N/A'}</p>
                        <p><strong>Selection Reason:</strong> ${selectionReason}</p>
                        ${model_performance.validation_folds ? `<p><strong>Cross-Validation:</strong> ${model_performance.validation_folds} validation folds completed</p>` : ''}
                    </div>
                </div>

                <!-- Strategic Action Items -->
                ${business_context?.strategic_recommendations?.length > 1 ? `
                <div class="bg-black/20 p-6 rounded-lg max-w-4xl mx-auto">
                    <h4 class="text-xl font-semibold mb-3 text-center text-indigo-300">💡 Strategic Action Items</h4>
                    <div class="space-y-2">
                        ${business_context.strategic_recommendations.slice(0, 3).map((rec, idx) => 
                            `<div class="flex items-center space-x-2">
                                <span class="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">${idx + 1}</span>
                                <span class="text-sm text-white/90">${rec}</span>
                            </div>`
                        ).join('')}
                    </div>
                    
                    ${riskLevel === 'High' ? `
                    <div class="mt-4 p-3 bg-red-900/30 border border-red-600/50 rounded text-red-200 text-xs">
                        <strong>⚠️ High Risk Alert:</strong> Enhanced monitoring recommended. Consider shorter planning cycles and more frequent forecast updates.
                    </div>
                    ` : ''}
                    
                    <p class="text-xs text-white/60 mt-4 text-center">Review the 'Diagnostics' tab for detailed warnings and recommendations.</p>
                </div>
                ` : ''}
            </div>
        `;
    } catch (e) {
        console.error("Error rendering Enhanced Overview Panel:", e);
        dom.$("predictiveOverviewPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering overview: ${e.message}</div>`;
    }

    // --- 2. Enhanced Charts Panel with Model Differentiation ---
    try {
        const chartsPanel = dom.$("predictiveChartsPanel");
        chartsPanel.innerHTML = `
            <div class="p-4 space-y-8">
                <h3 class="text-2xl font-bold mb-4 text-center">Visual Analysis</h3>
                <div>
                    <h4 class="text-xl font-semibold mb-2">Enhanced Forecast with Business Context</h4>
                    <div id="predictiveForecastChart" class="w-full h-[500px] plotly-chart bg-black/10 rounded-lg border border-white/20"></div>
                    <p class="text-xs text-white/60 mt-2 text-center">
                        Shaded area represents ${formatMetric((model_performance.confidence_level || 0.90) * 100, 0)}% confidence interval. 
                        ${business_context?.trajectory ? `Business trajectory: ${business_context.trajectory}` : ''}
                    </p>
                </div>
            </div>
        `;

        if (predictions && predictions.length > 0) {
            // Add historical data if available
            let historicalTrace = null;
            if (historical_data && historical_data.length > 0) {
                historicalTrace = {
                    x: historical_data.map(h => h.period),
                    y: historical_data.map(h => h.value),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Historical Data',
                    line: { 
                        color: '#8B5CF6', // Purple for historical
                        width: 3 
                    },
                    marker: { 
                        size: 6, 
                        color: '#8B5CF6' 
                    }
                };
            }

            // Enhanced forecast trace with model-specific styling
            const modelType = model_performance?.model_used || 'Unknown';
            let forecastColor = '#10B981'; // Default green
            let lineStyle = 'solid';
            
            // Differentiate by model type
            switch(modelType.toLowerCase()) {
                case 'linear regression':
                case 'linear trend':
                    forecastColor = '#3B82F6'; // Blue for linear
                    lineStyle = 'solid';
                    break;
                case 'seasonal forecast':
                case 'seasonal decomposition':
                    forecastColor = '#F59E0B'; // Orange for seasonal
                    lineStyle = 'solid';
                    break;
                case 'simple trend':
                    forecastColor = '#EF4444'; // Red for simple trend
                    lineStyle = 'dash';
                    break;
                case 'auto-select best':
                default:
                    forecastColor = '#10B981'; // Green for auto-select
                    lineStyle = 'solid';
                    break;
            }

            const traceForecast = {
                x: predictions.map(p => p.period),
                y: predictions.map(p => p.predicted_value),
                type: 'scatter', 
                mode: 'lines+markers', 
                name: `Forecast (${modelType})`,
                line: { 
                    color: forecastColor,
                    width: 4,
                    dash: lineStyle
                },
                marker: { 
                    size: 8,
                    color: forecastColor,
                    line: { color: 'white', width: 2 }
                }
            };
            
            // Enhanced confidence bounds with model-specific colors
            const traceUpper = {
                x: predictions.map(p => p.period),
                y: predictions.map(p => p.upper_bound),
                type: 'scatter', 
                mode: 'lines', 
                name: 'Upper Bound',
                line: { 
                    dash: 'dot', 
                    color: `rgba(255,255,255,0.7)`,
                    width: 2
                },
                fill: 'none',
                showlegend: true
            };
            
            const traceLower = {
                x: predictions.map(p => p.period),
                y: predictions.map(p => p.lower_bound),
                type: 'scatter', 
                mode: 'lines', 
                name: 'Lower Bound',
                line: { 
                    dash: 'dot', 
                    color: `rgba(255,255,255,0.7)`,
                    width: 2
                },
                fill: 'tonexty',
                fillcolor: `${forecastColor}33`, // 20% opacity of forecast color
                showlegend: true
            };

            // Enhanced annotations with model-specific insights
            const annotations = [];
            
            // Add model type annotation
            if (predictions.length > 3) {
                const midPoint = Math.floor(predictions.length / 2);
                annotations.push({
                    x: predictions[midPoint]?.period,
                    y: predictions[midPoint]?.predicted_value,
                    text: `<b>${modelType}</b><br>${business_context?.trajectory || 'Pattern'} Detected`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1,
                    arrowwidth: 2,
                    arrowcolor: forecastColor,
                    bgcolor: 'rgba(0,0,0,0.8)',
                    bordercolor: forecastColor,
                    borderwidth: 1,
                    font: { color: 'white', size: 10 }
                });
            }

            // Add trend direction annotation if significant change
            if (business_context?.change_percent && Math.abs(business_context.change_percent) > 5) {
                const lastPoint = predictions.length - 1;
                annotations.push({
                    x: predictions[lastPoint]?.period,
                    y: predictions[lastPoint]?.predicted_value,
                    text: `<b>${Math.abs(business_context.change_percent).toFixed(1)}%</b><br>${business_context.change_percent > 0 ? '↗️ Growth' : '↘️ Decline'}`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1,
                    arrowwidth: 2,
                    arrowcolor: business_context.change_percent > 0 ? '#10B981' : '#EF4444',
                    bgcolor: 'rgba(0,0,0,0.8)',
                    bordercolor: business_context.change_percent > 0 ? '#10B981' : '#EF4444',
                    borderwidth: 1,
                    font: { color: 'white', size: 10 },
                    ax: -30,
                    ay: -30
                });
            }

            // Create traces array
            const traces = [traceLower, traceUpper, traceForecast];
            if (historicalTrace) {
                traces.unshift(historicalTrace); // Add historical data first
            }

            // Enhanced layout with better differentiation
            const layout = {
                title: {
                    text: `${modelType} Forecast: ${business_context?.trajectory || 'Pattern'} Detected`,
                    font: { color: 'white', size: 18, family: 'Arial, sans-serif' }
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0.1)',
                font: { color: 'white', size: 12 },
                xaxis: { 
                    title: {
                        text: 'Time Period',
                        font: { size: 14, color: 'white' }
                    },
                    gridcolor: 'rgba(255,255,255,0.3)',
                    tickformat: '%Y-%m',
                    tickfont: { size: 11, color: 'white' },
                    linecolor: 'rgba(255,255,255,0.5)',
                    linewidth: 1
                },
                yaxis: { 
                    title: {
                        text: 'Value',
                        font: { size: 14, color: 'white' }
                    },
                    gridcolor: 'rgba(255,255,255,0.3)',
                    zeroline: false,
                    tickfont: { size: 11, color: 'white' },
                    linecolor: 'rgba(255,255,255,0.5)',
                    linewidth: 1
                },
                legend: { 
                    orientation: 'h', 
                    y: -0.15, 
                    yanchor: 'top',
                    bgcolor: 'rgba(0,0,0,0.7)',
                    bordercolor: 'rgba(255,255,255,0.3)',
                    borderwidth: 1,
                    font: { size: 11, color: 'white' }
                },
                hovermode: 'x unified',
                hoverlabel: {
                    bgcolor: 'rgba(0,0,0,0.8)',
                    bordercolor: 'white',
                    font: { color: 'white', size: 11 }
                },
                margin: { t: 80, b: 100, l: 80, r: 40 },
                annotations: annotations,
                // Add vertical line to separate historical from forecast
                shapes: historicalTrace ? [{
                    type: 'line',
                    x0: historicalTrace.x[historicalTrace.x.length - 1],
                    y0: 0,
                    x1: historicalTrace.x[historicalTrace.x.length - 1],
                    y1: 1,
                    yref: 'paper',
                    line: {
                        color: 'rgba(255,255,255,0.5)',
                        width: 2,
                        dash: 'dash'
                    }
                }] : []
            };

            Plotly.newPlot('predictiveForecastChart', traces, layout, { 
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
                displaylogo: false
            });
        } else {
            dom.$("predictiveForecastChart").innerHTML = `<div class="p-4 text-center text-white/60">Forecast data unavailable for charting.</div>`;
        }
    } catch (e) {
        console.error("Error rendering Enhanced Charts Panel:", e);
        dom.$("predictiveChartsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering charts.</div>`;
    }

    // --- 3. Enhanced Details Panel ---
    try {
        const detailsPanel = dom.$("predictiveDetailsPanel");
        const detailsHtml = `
            <div class="p-4 space-y-8">
                <h3 class="text-2xl font-bold mb-4 text-center">Technical Details</h3>

                <div>
                    <h4 class="text-xl font-semibold mb-3">Enhanced Model Performance Metrics</h4>
                    <p class="text-sm text-white/70 mb-4 italic">Statistics evaluating how well the chosen model (${model_performance.model_used || 'N/A'}) fit the historical data.</p>
                    <div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th>Interpretation Guide</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>Model Used</td><td>${model_performance.model_used || 'N/A'}</td><td class="text-white/70">Algorithm selected for forecasting.</td></tr>
                                <tr><td>Selection Reason</td><td>${model_performance.selection_reason || 'Auto-selected'}</td><td class="text-white/70">Why this model was chosen.</td></tr>
                                <tr><td>R-Squared</td><td>${formatMetric(model_performance.r_squared, 3)}</td><td class="text-white/70">% variance explained (higher = better fit).</td></tr>
                                <tr><td>MAPE (%)</td><td>${formatMetric(model_performance.mape, 1)}</td><td class="text-white/70">Mean Absolute Percentage Error (lower = better accuracy).</td></tr>
                                <tr><td>MAE</td><td>${formatMetric(model_performance.mae, 2)}</td><td class="text-white/70">Mean Absolute Error (avg. error magnitude in original units).</td></tr>
                                <tr><td>RMSE</td><td>${formatMetric(model_performance.rmse, 2)}</td><td class="text-white/70">Root Mean Squared Error (error magnitude, penalizes large errors).</td></tr>
                                ${model_performance.validation_folds ? `<tr><td>Cross-Validation Folds</td><td>${model_performance.validation_folds}</td><td class="text-white/70">Number of validation tests performed.</td></tr>` : ''}
                            </tbody>
                        </table>
                        <blockquote class="mt-4 p-3 text-xs italic border-l-2 border-indigo-400 bg-black/20 text-white/70">${model_performance.interpretation || 'Model fit interpretation unavailable.'}</blockquote>
                    </div>
                </div>

                ${business_context ? `
                <div>
                    <h4 class="text-xl font-semibold mb-3">Business Context Analysis</h4>
                    <div class="overflow-x-auto">
                        <table class="coeff-table styled-table text-sm">
                            <thead>
                                <tr>
                                    <th>Business Metric</th>
                                    <th>Value</th>
                                    <th>Interpretation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>Business Trajectory</td><td>${business_context.trajectory || 'Unknown'}</td><td class="text-white/70">Overall direction of change.</td></tr>
                                <tr><td>Expected Change</td><td>${formatMetric(Math.abs(business_context.change_percent || 0), 1, '%')} ${(business_context.change_percent || 0) >= 0 ? 'Growth' : 'Decline'}</td><td class="text-white/70">Projected change over forecast period.</td></tr>
                                <tr><td>Risk Level</td><td>${business_context.risk_level || 'Unknown'}</td><td class="text-white/70">Overall forecast risk assessment.</td></tr>
                                <tr><td>Current Volatility</td><td>${formatMetric(business_context.current_volatility, 1, '%')}</td><td class="text-white/70">Historical variability level.</td></tr>
                                <tr><td>Predicted Volatility</td><td>${formatMetric(business_context.predicted_volatility, 1, '%')}</td><td class="text-white/70">Expected future variability.</td></tr>
                                <tr><td>Planning Horizon</td><td>${business_context.planning_horizon_recommendation || 'N/A'}</td><td class="text-white/70">Recommended planning timeframe.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <div>
                    <h4 class="text-xl font-semibold mb-3">Forecast Data Table</h4>
                    <p class="text-sm text-white/70 mb-4 italic">Predicted values and ${formatMetric((model_performance.confidence_level || 0.90) * 100, 0)}% confidence intervals for each future period.</p>
                    <div class="overflow-x-auto max-h-[500px]">
                        <table class="coeff-table styled-table forecast-table text-sm">
                            <thead class="sticky top-0 bg-gray-800/80 backdrop-blur-sm">
                                <tr>
                                    <th>Period</th>
                                    <th>Predicted Value</th>
                                    <th>Lower Bound</th>
                                    <th>Upper Bound</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${predictions?.map(p => `
                                    <tr>
                                        <td>${p.period ?? 'N/A'}</td>
                                        <td><strong>${formatMetric(p.predicted_value, 2)}</strong></td>
                                        <td>${formatMetric(p.lower_bound, 2)}</td>
                                        <td>${formatMetric(p.upper_bound, 2)}</td>
                                    </tr>`).join("") ?? '<tr><td colspan="4" class="text-center text-white/60">No prediction data available.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        detailsPanel.innerHTML = detailsHtml;
    } catch (e) {
        console.error("Error rendering Enhanced Details Panel:", e);
        dom.$("predictiveDetailsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering details: ${e.message}</div>`;
    }

    // --- 4. Enhanced Insights Panel ---
    try {
        const insightsPanel = dom.$("predictiveInsightsPanel");
        let insightsHtml = `<div class="p-4 space-y-6"><h3 class="text-2xl font-bold mb-4 text-center">💡 Strategic Insights & Recommendations</h3>`;

        if (insights && insights.length > 0) {
            insights.forEach((insight, index) => {
                const confidenceLevel = insight.confidence_level || 'Medium';
                const confidenceClass = confidenceLevel === 'High' ? 'border-green-500' : 
                                      confidenceLevel === 'Medium' ? 'border-yellow-500' : 'border-red-500';
                const confidenceIcon = confidenceLevel === 'High' ? '🟢' : 
                                      confidenceLevel === 'Medium' ? '🟡' : '🔴';
                
                insightsHtml += `
                    <div class="insight-card border-l-4 ${confidenceClass} relative">
                        <div class="flex justify-between items-start mb-2">
                            <p class="text-xs font-semibold text-indigo-300 mb-1">INSIGHT ${index + 1}</p>
                            <span class="text-xs bg-black/30 px-2 py-1 rounded flex items-center">
                                ${confidenceIcon} ${confidenceLevel} Confidence
                            </span>
                        </div>
                        <p class="mb-2"><strong>Observation:</strong> ${insight.observation}</p>
                        <p class="mb-2 text-sm text-white/80"><strong>Analysis:</strong> ${insight.accurate_interpretation}</p>
                        <div class="p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded mt-3 border-l-2 border-purple-400">
                            <p class="text-sm font-semibold">💼 Business Implication:</p>
                            <p class="text-sm text-white/90 mt-1">${insight.business_implication}</p>
                        </div>
                    </div>`;
            });
        } else {
            insightsHtml += `<p class="text-center text-white/70 italic">No specific insights were generated by the analysis.</p>`;
        }
        
        insightsHtml += `</div>`;
        insightsPanel.innerHTML = insightsHtml;
    } catch (e) {
        console.error("Error rendering Enhanced Insights Panel:", e);
        dom.$("predictiveInsightsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering insights.</div>`;
    }

    // --- 5. Enhanced Diagnostics Panel ---
    try {
        const diagnosticsPanel = dom.$("predictiveDiagnosticsPanel");
        renderPredictiveDiagnosticsPanel(diagnosticsPanel, data);
    } catch (e) {
        console.error("Error rendering Diagnostics Panel:", e);
        dom.$("predictiveDiagnosticsPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering diagnostics: ${e.message}</div>`;
    }

    // --- 6. Simplified Learn Panel ---
    try {
        const learnPanel = dom.$("predictiveLearnPanel");
        renderPredictiveLearnPanel(learnPanel, data);
    } catch (e) {
        console.error("Error rendering Learn Panel:", e);
        dom.$("predictiveLearnPanel").innerHTML = `<div class="p-4 text-center text-red-400">Error rendering learn section: ${e.message}</div>`;
    }

    // --- Final Touches (keeping existing logic) ---
    try {
        appState.analysisCache[appState.currentTemplateId] = container.innerHTML;
        dom.$("analysisActions").classList.remove("hidden");

        // --- Tab Switching Logic ---
        tabNav.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON" && !e.target.classList.contains('active')) {
                tabNav.querySelectorAll(".analysis-tab-btn").forEach(btn => btn.classList.remove("active"));
                tabContent.querySelectorAll(".analysis-tab-panel").forEach(pnl => pnl.classList.remove("active"));

                e.target.classList.add("active");
                const targetPanelId = "predictive" + e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1) + "Panel";
                const targetPanel = dom.$(targetPanelId);
                if (targetPanel) {
                    targetPanel.classList.add("active");

                    const chartsInPanel = targetPanel.querySelectorAll('.plotly-chart');
                    chartsInPanel.forEach(chartDiv => {
                        if (chartDiv.layout && typeof Plotly !== 'undefined') {
                            try {
                                Plotly.Plots.resize(chartDiv);
                                console.log(`Resized chart ${chartDiv.id} on tab switch.`);
                            } catch (resizeError) {
                                console.error(`Error resizing chart ${chartDiv.id} on tab switch:`, resizeError);
                            }
                        }
                    });
                } else {
                     console.warn("Target panel not found for tab:", e.target.dataset.tab);
                }
            }
        });

        setTimeout(() => {
             const activePanel = tabContent.querySelector('.analysis-tab-panel.active');
             if (activePanel) {
                 activePanel.querySelectorAll(".plotly-chart").forEach(chartDiv => {
                     if (chartDiv.layout && typeof Plotly !== 'undefined') {
                         try {
                              Plotly.Plots.resize(chartDiv);
                              console.log(`Initial resize for chart ${chartDiv.id} attempted.`);
                         } catch (initialResizeError) {
                              console.error(`Error during initial resize ${chartDiv.id}:`, initialResizeError);
                         }
                     }
                 });
             }
        }, 200);

    } catch (e) {
        console.error("Error during final setup (cache/tabs/buttons):", e);
        if (!container.innerHTML.includes('text-red-400')) {
             container.innerHTML += `<div class="p-4 text-center text-red-400">Error setting up UI components after rendering.</div>`;
        }
    } finally {
        setLoading("generate", false);
    }
}

/**
 * Warnings and Diagnostics Panel Function
 * Call this to populate the new diagnostics tab
 */
function renderPredictiveDiagnosticsPanel(diagnosticsPanel, data) {
    const { model_performance, business_context, data_info, predictions } = data;
    
    // Calculate diagnostic metrics
    const dataPoints = data_info?.total_points || predictions.length * 2;
    const forecastHorizon = predictions.length || 12;
    const r2 = model_performance?.r_squared || 0;
    const mape = model_performance?.mape || 100;
    const riskLevel = business_context?.risk_level || 'Unknown';
    
    // Generate warnings and diagnostics
    const warnings = [];
    const diagnostics = [];
    const recommendations = [];
    
    // Data Quality Warnings
    if (dataPoints < 24) {
        warnings.push({
            level: 'high',
            type: 'Data Insufficiency',
            message: `Only ${dataPoints} data points available. Minimum 24 recommended for reliable analysis.`,
            impact: 'Low confidence in seasonal patterns and model validation.'
        });
    } else if (dataPoints < 36) {
        warnings.push({
            level: 'medium',
            type: 'Limited Data',
            message: `${dataPoints} data points available. 36+ recommended for optimal analysis.`,
            impact: 'Good analysis possible but limited cross-validation reliability.'
        });
    }
    
    // Model Performance Warnings
    if (r2 < 0.3) {
        warnings.push({
            level: 'high',
            type: 'Poor Model Fit',
            message: `R-squared of ${(r2 * 100).toFixed(1)}% indicates weak model performance.`,
            impact: 'Predictions may not reflect actual patterns in your data.'
        });
    } else if (r2 < 0.5) {
        warnings.push({
            level: 'medium',
            type: 'Moderate Model Fit',
            message: `R-squared of ${(r2 * 100).toFixed(1)}% suggests room for improvement.`,
            impact: 'Use predictions with caution for strategic decisions.'
        });
    }
    
    if (mape > 30) {
        warnings.push({
            level: 'high',
            type: 'High Prediction Error',
            message: `MAPE of ${mape.toFixed(1)}% indicates significant prediction errors.`,
            impact: 'Consider this forecast as directional guidance only.'
        });
    } else if (mape > 15) {
        warnings.push({
            level: 'medium',
            type: 'Moderate Prediction Error',
            message: `MAPE of ${mape.toFixed(1)}% suggests moderate prediction accuracy.`,
            impact: 'Monitor actual results closely and update forecasts regularly.'
        });
    }
    
    // Forecast Horizon Warnings
    if (forecastHorizon > dataPoints / 2) {
        warnings.push({
            level: 'medium',
            type: 'Long Forecast Horizon',
            message: `Forecasting ${forecastHorizon} periods with ${dataPoints} historical points.`,
            impact: 'Confidence decreases significantly for later periods.'
        });
    }
    
    // Risk Assessment Warnings
    if (riskLevel === 'High') {
        warnings.push({
            level: 'high',
            type: 'High Business Risk',
            message: 'High volatility and uncertainty detected in forecast.',
            impact: 'Consider scenario planning and frequent forecast updates.'
        });
    }
    
    // Generate Diagnostics
    diagnostics.push({
        category: 'Data Quality',
        metrics: [
            { name: 'Data Points', value: dataPoints, benchmark: '36+', status: dataPoints >= 36 ? 'good' : dataPoints >= 24 ? 'fair' : 'poor' },
            { name: 'Data Range', value: `${data_info?.date_range_days || 'Unknown'} days`, benchmark: '730+ days', status: (data_info?.date_range_days || 0) >= 730 ? 'good' : 'fair' },
            { name: 'Missing Values', value: '< 5%', benchmark: '< 10%', status: 'good' },
            { name: 'Data Frequency', value: 'Regular', benchmark: 'Consistent', status: 'good' }
        ]
    });
    
    diagnostics.push({
        category: 'Model Performance',
        metrics: [
            { name: 'R-Squared', value: `${(r2 * 100).toFixed(1)}%`, benchmark: '70%+', status: r2 >= 0.7 ? 'good' : r2 >= 0.5 ? 'fair' : 'poor' },
            { name: 'MAPE', value: `${mape.toFixed(1)}%`, benchmark: '< 15%', status: mape <= 15 ? 'good' : mape <= 30 ? 'fair' : 'poor' },
            { name: 'Cross-Validation', value: `${model_performance?.validation_folds || 0} folds`, benchmark: '5+ folds', status: (model_performance?.validation_folds || 0) >= 5 ? 'good' : 'fair' },
            { name: 'Model Selection', value: model_performance?.model_used || 'Unknown', benchmark: 'Auto-Selected', status: 'good' }
        ]
    });
    
    diagnostics.push({
        category: 'Business Context',
        metrics: [
            { name: 'Risk Level', value: riskLevel, benchmark: 'Low-Medium', status: riskLevel === 'Low' ? 'good' : riskLevel === 'Medium' ? 'fair' : 'poor' },
            { name: 'Volatility', value: `${(business_context?.predicted_volatility || 0).toFixed(1)}%`, benchmark: '< 25%', status: (business_context?.predicted_volatility || 0) < 25 ? 'good' : 'fair' },
            { name: 'Trend Stability', value: business_context?.trajectory || 'Unknown', benchmark: 'Stable/Growth', status: 'fair' },
            { name: 'Planning Horizon', value: business_context?.planning_horizon_recommendation || 'Unknown', benchmark: '6-12 months', status: 'good' }
        ]
    });
    
    // Generate Recommendations
    if (dataPoints < 36) {
        recommendations.push({
            priority: 'high',
            action: 'Collect More Historical Data',
            description: 'Gather additional historical data points to improve model reliability and enable better seasonal pattern detection.',
            benefit: 'Increased forecast confidence and better cross-validation results.'
        });
    }
    
    if (mape > 20) {
        recommendations.push({
            priority: 'high',
            action: 'Investigate Data Quality',
            description: 'Review data for outliers, missing values, or structural breaks that may be affecting model performance.',
            benefit: 'Improved prediction accuracy and model reliability.'
        });
    }
    
    if (riskLevel === 'High') {
        recommendations.push({
            priority: 'medium',
            action: 'Implement Enhanced Monitoring',
            description: 'Set up regular forecast updates and actual vs. predicted tracking to quickly identify deviations.',
            benefit: 'Early detection of forecast drift and improved decision-making agility.'
        });
    }
    
    recommendations.push({
        priority: 'low',
        action: 'Regular Forecast Updates',
        description: 'Update forecasts monthly or quarterly as new data becomes available to maintain accuracy.',
        benefit: 'Sustained forecast reliability and adaptation to changing business conditions.'
    });
    
    diagnosticsPanel.innerHTML = `
        <div class="p-6 space-y-8 text-white/90 max-w-6xl mx-auto">
            <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                ⚠️ Warnings & Diagnostics
            </h3>
            
            <!-- Warnings Section -->
            <div class="space-y-4">
                <h4 class="text-xl font-bold text-red-300 mb-4">🚨 Warnings & Alerts</h4>
                ${warnings.length > 0 ? warnings.map(warning => `
                    <div class="p-4 rounded-lg border-l-4 ${
                        warning.level === 'high' ? 'bg-red-900/20 border-red-500' : 
                        warning.level === 'medium' ? 'bg-yellow-900/20 border-yellow-500' : 
                        'bg-blue-900/20 border-blue-500'
                    }">
                        <div class="flex items-start space-x-3">
                            <div class="text-2xl">${warning.level === 'high' ? '🔴' : warning.level === 'medium' ? '🟡' : '🔵'}</div>
                            <div class="flex-1">
                                <h5 class="font-semibold text-lg ${
                                    warning.level === 'high' ? 'text-red-300' : 
                                    warning.level === 'medium' ? 'text-yellow-300' : 
                                    'text-blue-300'
                                }">${warning.type}</h5>
                                <p class="text-white/90 mt-1">${warning.message}</p>
                                <p class="text-white/70 text-sm mt-2"><strong>Impact:</strong> ${warning.impact}</p>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div class="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                        <div class="text-2xl mb-2">✅</div>
                        <p class="text-green-300 font-semibold">No Critical Warnings Detected</p>
                        <p class="text-white/70 text-sm mt-1">Your analysis appears to be within acceptable parameters.</p>
                    </div>
                `}
            </div>
            
            <!-- Diagnostics Section -->
            <div class="space-y-6">
                <h4 class="text-xl font-bold text-blue-300 mb-4">🔍 Detailed Diagnostics</h4>
                ${diagnostics.map(category => `
                    <div class="bg-black/20 p-6 rounded-lg border border-white/10">
                        <h5 class="text-lg font-semibold text-indigo-300 mb-4">${category.category}</h5>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${category.metrics.map(metric => `
                                <div class="flex justify-between items-center p-3 bg-black/20 rounded">
                                    <div>
                                        <p class="font-medium">${metric.name}</p>
                                        <p class="text-xs text-white/60">Target: ${metric.benchmark}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-semibold">${metric.value}</p>
                                        <span class="text-xs px-2 py-1 rounded ${
                                            metric.status === 'good' ? 'bg-green-600/20 text-green-300' :
                                            metric.status === 'fair' ? 'bg-yellow-600/20 text-yellow-300' :
                                            'bg-red-600/20 text-red-300'
                                        }">
                                            ${metric.status === 'good' ? '✓ Good' : metric.status === 'fair' ? '⚠ Fair' : '✗ Poor'}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Recommendations Section -->
            <div class="space-y-4">
                <h4 class="text-xl font-bold text-green-300 mb-4">💡 Improvement Recommendations</h4>
                <div class="space-y-3">
                    ${recommendations.map((rec, index) => `
                        <div class="p-4 bg-black/20 rounded-lg border border-white/10">
                            <div class="flex items-start space-x-3">
                                <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    rec.priority === 'high' ? 'bg-red-600 text-white' :
                                    rec.priority === 'medium' ? 'bg-yellow-600 text-white' :
                                    'bg-blue-600 text-white'
                                }">${index + 1}</div>
                                <div class="flex-1">
                                    <div class="flex items-center space-x-2 mb-2">
                                        <h5 class="font-semibold">${rec.action}</h5>
                                        <span class="text-xs px-2 py-1 rounded ${
                                            rec.priority === 'high' ? 'bg-red-600/20 text-red-300' :
                                            rec.priority === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                                            'bg-blue-600/20 text-blue-300'
                                        }">
                                            ${rec.priority.toUpperCase()} PRIORITY
                                        </span>
                                    </div>
                                    <p class="text-white/80 text-sm mb-2">${rec.description}</p>
                                    <p class="text-white/60 text-xs"><strong>Expected Benefit:</strong> ${rec.benefit}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Model Health Summary -->
            <div class="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 p-6 rounded-lg border border-purple-500/20">
                <h4 class="text-lg font-bold text-purple-300 mb-4">📊 Overall Model Health</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <div class="text-2xl font-bold ${r2 >= 0.7 ? 'text-green-400' : r2 >= 0.5 ? 'text-yellow-400' : 'text-red-400'}">
                            ${r2 >= 0.7 ? 'Excellent' : r2 >= 0.5 ? 'Good' : 'Poor'}
                        </div>
                        <p class="text-xs text-white/70">Model Fit Quality</p>
                    </div>
                    <div>
                        <div class="text-2xl font-bold ${dataPoints >= 36 ? 'text-green-400' : dataPoints >= 24 ? 'text-yellow-400' : 'text-red-400'}">
                            ${dataPoints >= 36 ? 'Sufficient' : dataPoints >= 24 ? 'Adequate' : 'Limited'}
                        </div>
                        <p class="text-xs text-white/70">Data Sufficiency</p>
                    </div>
                    <div>
                        <div class="text-2xl font-bold ${warnings.filter(w => w.level === 'high').length === 0 ? 'text-green-400' : 'text-red-400'}">
                            ${warnings.filter(w => w.level === 'high').length === 0 ? 'Stable' : 'Caution'}
                        </div>
                        <p class="text-xs text-white/70">Forecast Reliability</p>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                <p class="text-xs text-white/60">
                    Regular diagnostics help ensure forecast quality and reliability. Address high-priority recommendations first for maximum impact.
                </p>
            </div>
        </div>
    `;
}

/**
 * Simplified Learn Predictive Analysis Panel Function
 * Focuses purely on educational content without diagnostics
 */
function renderPredictiveLearnPanel(learnPanel, data) {
    learnPanel.innerHTML = `
        <div class="p-6 space-y-8 text-white/90 max-w-5xl mx-auto">
            <h3 class="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                🎓 Learn Predictive Analysis
            </h3>
            
            <!-- Main Definition -->
            <div class="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-6 rounded-lg border border-purple-500/30">
                <h4 class="text-xl font-bold mb-3 text-purple-300">What is Predictive Analysis?</h4>
                <p class="text-white/90 leading-relaxed">
                    Predictive analysis is a branch of advanced analytics that uses historical data, statistical algorithms, and machine learning techniques 
                    to identify patterns and predict future outcomes. Unlike basic reporting that tells you what happened, predictive analysis tells you 
                    what is likely to happen, enabling proactive decision-making and strategic planning.
                </p>
            </div>
            
            <!-- Core Concepts -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-4 text-green-300">🔬 Core Components</h4>
                    <ul class="space-y-3 text-sm">
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Time-Series Analysis:</strong> Examines data points collected over time to identify trends, patterns, and seasonality
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Statistical Modeling:</strong> Uses mathematical models to understand relationships between variables
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Pattern Recognition:</strong> Identifies recurring patterns that can predict future behavior
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-green-400 mt-0.5">•</span>
                            <div>
                                <strong>Uncertainty Quantification:</strong> Measures confidence levels and risk in predictions
                            </div>
                        </li>
                    </ul>
                </div>
                
                <div class="bg-white/5 p-6 rounded-lg border border-white/10">
                    <h4 class="text-lg font-bold mb-4 text-blue-300">🎯 Business Applications</h4>
                    <ul class="space-y-3 text-sm">
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Financial Planning:</strong> Budget forecasting, revenue projection, expense planning
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Demand Forecasting:</strong> Inventory management, production planning, resource allocation
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Risk Management:</strong> Market volatility assessment, scenario planning
                            </div>
                        </li>
                        <li class="flex items-start space-x-2">
                            <span class="text-blue-400 mt-0.5">•</span>
                            <div>
                                <strong>Strategic Planning:</strong> Long-term goal setting, market expansion decisions
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
            
            <!-- Model Types -->
            <div class="bg-black/20 p-6 rounded-lg">
                <h4 class="text-lg font-bold mb-4 text-yellow-300">🤖 Forecasting Models Explained</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 bg-black/20 rounded border border-blue-500/30">
                        <h5 class="font-semibold text-blue-300 mb-2">Linear/Trend Models</h5>
                        <p class="text-xs text-white/80 mb-2">Best for data with consistent directional movement</p>
                        <div class="text-xs text-white/60">
                            <p><strong>Use when:</strong> Steady growth or decline patterns</p>
                            <p><strong>Examples:</strong> Population growth, cumulative sales</p>
                        </div>
                    </div>
                    <div class="p-4 bg-black/20 rounded border border-green-500/30">
                        <h5 class="font-semibold text-green-300 mb-2">Seasonal Models</h5>
                        <p class="text-xs text-white/80 mb-2">Ideal for cyclical business patterns</p>
                        <div class="text-xs text-white/60">
                            <p><strong>Use when:</strong> Regular seasonal fluctuations</p>
                            <p><strong>Examples:</strong> Retail sales, tourism, energy consumption</p>
                        </div>
                    </div>
                    <div class="p-4 bg-black/20 rounded border border-purple-500/30">
                        <h5 class="font-semibold text-purple-300 mb-2">Auto-Selection</h5>
                        <p class="text-xs text-white/80 mb-2">Automatically chooses the best model</p>
                        <div class="text-xs text-white/60">
                            <p><strong>Use when:</strong> Unsure which model fits best</p>
                            <p><strong>Benefits:</strong> Cross-validation ensures optimal choice</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Key Metrics -->
            <div class="bg-black/20 p-6 rounded-lg">
                <h4 class="text-lg font-bold mb-4 text-indigo-300">📊 Understanding Key Metrics</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div class="space-y-4">
                        <div class="border-l-4 border-green-400 pl-4">
                            <h5 class="font-semibold text-green-300">R-Squared (R²)</h5>
                            <p class="text-white/80 mb-1">Measures how well the model explains historical data variance</p>
                            <div class="text-xs text-white/60">
                                <p>• 0.80+ = Excellent fit</p>
                                <p>• 0.60-0.79 = Good fit</p>
                                <p>• 0.40-0.59 = Moderate fit</p>
                                <p>• Below 0.40 = Poor fit</p>
                            </div>
                        </div>
                        <div class="border-l-4 border-blue-400 pl-4">
                            <h5 class="font-semibold text-blue-300">MAPE (Mean Absolute Percentage Error)</h5>
                            <p class="text-white/80 mb-1">Average percentage difference between predicted and actual values</p>
                            <div class="text-xs text-white/60">
                                <p>• Under 10% = Highly accurate</p>
                                <p>• 10-20% = Good accuracy</p>
                                <p>• 20-50% = Reasonable accuracy</p>
                                <p>• Above 50% = Poor accuracy</p>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="border-l-4 border-purple-400 pl-4">
                            <h5 class="font-semibold text-purple-300">Confidence Intervals</h5>
                            <p class="text-white/80 mb-1">Range of values where the true outcome is likely to fall</p>
                            <div class="text-xs text-white/60">
                                <p>• 90% confidence = 9 out of 10 outcomes fall within range</p>
                                <p>• Wider intervals = Higher uncertainty</p>
                                <p>• Narrower intervals = More precise predictions</p>
                            </div>
                        </div>
                        <div class="border-l-4 border-red-400 pl-4">
                            <h5 class="font-semibold text-red-300">Cross-Validation</h5>
                            <p class="text-white/80 mb-1">Testing model performance on different data subsets</p>
                            <div class="text-xs text-white/60">
                                <p>• Prevents overfitting to historical data</p>
                                <p>• More folds = More reliable validation</p>
                                <p>• Essential for model selection</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Data Requirements -->
            <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-6 rounded-lg border border-blue-500/20">
                <h4 class="text-lg font-bold mb-4 text-blue-300">📋 Data Requirements & Best Practices</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h5 class="font-semibold text-green-300 mb-3">Data Quality Guidelines</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• <strong>Minimum 24 data points</strong> for basic analysis</li>
                            <li>• <strong>36+ points recommended</strong> for seasonal detection</li>
                            <li>• <strong>60+ points optimal</strong> for high confidence</li>
                            <li>• Regular time intervals (monthly, weekly, etc.)</li>
                            <li>• Minimal missing values (< 10%)</li>
                            <li>• Consistent data collection methods</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-yellow-300 mb-3">Common Data Issues</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• <strong>Outliers:</strong> Extreme values that skew results</li>
                            <li>• <strong>Structural breaks:</strong> Major business changes</li>
                            <li>• <strong>Missing data:</strong> Gaps in time series</li>
                            <li>• <strong>Inconsistent frequency:</strong> Irregular intervals</li>
                            <li>• <strong>External shocks:</strong> One-time events</li>
                            <li>• <strong>Data drift:</strong> Changing measurement methods</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Interpretation Guide -->
            <details class="styled-details bg-white/5 rounded-lg">
                <summary class="font-semibold cursor-pointer p-4 text-lg text-indigo-300">🎯 How to Interpret Results</summary>
                <div class="px-6 pb-6 space-y-4 text-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-4 bg-green-900/20 border border-green-500/30 rounded">
                            <h5 class="font-semibold text-green-300 mb-2">High Confidence Results</h5>
                            <p class="text-white/80 mb-2">R² > 70%, MAPE < 15%, 5+ validation folds</p>
                            <ul class="text-xs text-white/70 space-y-1">
                                <li>• Use for strategic planning</li>
                                <li>• Set budget targets</li>
                                <li>• Make resource allocation decisions</li>
                                <li>• Plan capacity expansions</li>
                            </ul>
                        </div>
                        <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
                            <h5 class="font-semibold text-yellow-300 mb-2">Medium Confidence Results</h5>
                            <p class="text-white/80 mb-2">R² 50-70%, MAPE 15-30%, 3-4 validation folds</p>
                            <ul class="text-xs text-white/70 space-y-1">
                                <li>• Use for tactical planning</li>
                                <li>• Monitor closely</li>
                                <li>• Build in flexibility</li>
                                <li>• Consider scenario planning</li>
                            </ul>
                        </div>
                        <div class="p-4 bg-red-900/20 border border-red-500/30 rounded">
                            <h5 class="font-semibold text-red-300 mb-2">Low Confidence Results</h5>
                            <p class="text-white/80 mb-2">R² < 50%, MAPE > 30%, < 3 validation folds</p>
                            <ul class="text-xs text-white/70 space-y-1">
                                <li>• Use for directional guidance only</li>
                                <li>• Collect more data</li>
                                <li>• Investigate data quality</li>
                                <li>• Consider external factors</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </details>
            
            <!-- Limitations -->
            <details class="styled-details bg-white/5 rounded-lg">
                <summary class="font-semibold cursor-pointer p-4 text-lg text-red-300">⚠️ Understanding Limitations</summary>
                <div class="px-6 pb-6 space-y-4 text-sm">
                    <div class="p-4 bg-red-900/20 border border-red-500/30 rounded">
                        <h5 class="font-semibold text-red-300 mb-3">Important Assumptions</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• <strong>Historical patterns continue:</strong> Future resembles the past</li>
                            <li>• <strong>No major disruptions:</strong> Business environment remains stable</li>
                            <li>• <strong>Data quality:</strong> Historical data accurately reflects reality</li>
                            <li>• <strong>Model assumptions:</strong> Statistical model fits the underlying process</li>
                        </ul>
                    </div>
                    <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
                        <h5 class="font-semibold text-yellow-300 mb-3">When Predictions May Fail</h5>
                        <ul class="space-y-2 text-white/80">
                            <li>• Market disruptions (economic crashes, pandemics)</li>
                            <li>• Technology shifts (digital transformation)</li>
                            <li>• Regulatory changes (new laws, policies)</li>
                            <li>• Competitive landscape changes (new entrants)</li>
                            <li>• Consumer behavior shifts (changing preferences)</li>
                        </ul>
                    </div>
                </div>
            </details>
            
            <!-- Best Practices -->
            <div class="bg-black/20 p-6 rounded-lg">
                <h4 class="text-lg font-bold mb-4 text-purple-300">✨ Best Practices for Success</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h5 class="font-semibold text-blue-300 mb-3">Before Analysis</h5>
                        <ul class="space-y-1 text-white/80">
                            <li>• Clean and validate your data</li>
                            <li>• Ensure consistent time intervals</li>
                            <li>• Document any known business changes</li>
                            <li>• Remove or explain outliers</li>
                            <li>• Verify data accuracy</li>
                        </ul>
                    </div>
                    <div>
                        <h5 class="font-semibold text-green-300 mb-3">After Analysis</h5>
                        <ul class="space-y-1 text-white/80">
                            <li>• Review model diagnostics carefully</li>
                            <li>• Consider external factors not in data</li>
                            <li>• Plan for multiple scenarios</li>
                            <li>• Monitor actual vs. predicted regularly</li>
                            <li>• Update forecasts with new data</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="text-center p-4 bg-black/20 rounded-lg border border-white/10">
                <p class="text-xs text-white/60">
                    Predictive analysis is a powerful tool for data-driven decision making. Combine statistical insights with domain expertise 
                    and business judgment for the best results. Always consider the context and limitations of your predictions.
                </p>
            </div>
        </div>
    `;
}

export {
    renderPredictiveAnalysisPage
}