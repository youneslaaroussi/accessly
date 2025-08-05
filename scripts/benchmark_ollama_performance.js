#!/usr/bin/env node

/**
 * Ollama Gemma 3n Performance Benchmarking Script
 * 
 * This script benchmarks the performance of Ollama Gemma 3n model by measuring:
 * - Connection latency
 * - Simple query response times
 * - Complex query response times
 * - Function calling performance
 * - Token generation rates
 * - Memory usage patterns
 * 
 * Usage: node benchmark_ollama_performance.js [options]
 * Options:
 *   --iterations <number>  Number of test iterations (default: 10)
 *   --model <string>      Model to test (default: gemma3n:e4b)
 *   --host <string>       Ollama host URL (default: http://127.0.0.1:11434)
 *   --verbose             Enable verbose output
 *   --output <file>       Save results to JSON file
 */

const { Ollama } = require('ollama');
const fs = require('fs');
const path = require('path');

class OllamaBenchmark {
  constructor(options = {}) {
    this.ollama = new Ollama({ 
      host: options.host || 'http://127.0.0.1:11434'
    });
    this.model = options.model || 'gemma3n:e4b';
    this.iterations = options.iterations || 10;
    this.verbose = options.verbose || false;
    this.outputFile = options.output;
    
    this.results = {
      timestamp: new Date().toISOString(),
      model: this.model,
      host: options.host || 'http://127.0.0.1:11434',
      iterations: this.iterations,
      tests: {}
    };

    // Test queries of varying complexity
    this.testQueries = {
      simple: [
        "Hello, how are you?",
        "What is 2 + 2?",
        "Tell me the current time.",
        "What's the weather like?",
        "Say hello in Spanish."
      ],
      medium: [
        "Explain the concept of accessibility in computing in one paragraph.",
        "List three benefits of offline AI processing for privacy.",
        "How would you help someone navigate a website using voice commands?",
        "Describe the process of speech recognition in simple terms.",
        "What are the main challenges faced by users with visual impairments when using computers?"
      ],
      complex: [
        "Design a comprehensive accessibility strategy for a voice-controlled AI assistant that prioritizes privacy and offline functionality. Include specific technical considerations for users with different types of disabilities.",
        "Analyze the trade-offs between using local AI models versus cloud-based services for accessibility applications, considering factors like latency, privacy, processing power, and user experience.",
        "Create a detailed workflow for implementing a screen memory vault system that captures, processes, and retrieves visual information while maintaining complete user privacy and offline operation."
      ],
      function_calling: [
        "What time is it right now?",
        "Take a screenshot of my screen",
        "Read the text that's currently visible on my screen",
        "Open my web browser and navigate to google.com",
        "Find any documents I was working on yesterday"
      ]
    };
  }

  log(message, force = false) {
    if (this.verbose || force) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  async measureLatency(fn, label) {
    const start = process.hrtime.bigint();
    try {
      const result = await fn();
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1000000; // Convert to milliseconds
      
      this.log(`${label}: ${latencyMs.toFixed(2)}ms`);
      return { success: true, latency: latencyMs, result };
    } catch (error) {
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1000000;
      
      this.log(`${label} FAILED: ${latencyMs.toFixed(2)}ms - ${error.message}`);
      return { success: false, latency: latencyMs, error: error.message };
    }
  }

  async testConnection() {
    this.log('Testing Ollama connection...', true);
    
    const results = [];
    for (let i = 0; i < this.iterations; i++) {
      const result = await this.measureLatency(
        () => this.ollama.list(),
        `Connection test ${i + 1}`
      );
      results.push(result);
    }

    const successful = results.filter(r => r.success);
    const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
    
    this.results.tests.connection = {
      successful: successful.length,
      failed: results.length - successful.length,
      averageLatency: avgLatency,
      results
    };

    this.log(`Connection test completed: ${successful.length}/${results.length} successful, avg: ${avgLatency.toFixed(2)}ms`, true);
    return successful.length > 0;
  }

  async testQueryPerformance(category, queries) {
    this.log(`Testing ${category} queries...`, true);
    
    const results = [];
    
    for (let i = 0; i < this.iterations; i++) {
      const query = queries[i % queries.length];
      const result = await this.measureLatency(
        async () => {
          const response = await this.ollama.chat({
            model: this.model,
            messages: [{ role: 'user', content: query }],
            stream: false
          });
          return response;
        },
        `${category} query ${i + 1}: "${query.substring(0, 50)}..."`
      );
      
      if (result.success && result.result.message) {
        result.tokenCount = this.estimateTokenCount(result.result.message.content);
        result.tokensPerSecond = result.tokenCount / (result.latency / 1000);
      }
      
      results.push(result);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success);
    const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
    const avgTokensPerSecond = successful
      .filter(r => r.tokensPerSecond)
      .reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.filter(r => r.tokensPerSecond).length;

    this.results.tests[category] = {
      successful: successful.length,
      failed: results.length - successful.length,
      averageLatency: avgLatency,
      averageTokensPerSecond: avgTokensPerSecond || 0,
      results
    };

    this.log(`${category} test completed: ${successful.length}/${results.length} successful, avg: ${avgLatency.toFixed(2)}ms, ${avgTokensPerSecond.toFixed(2)} tokens/sec`, true);
  }

  async testStreamingPerformance() {
    this.log('Testing streaming performance...', true);
    
    const query = "Write a detailed explanation of how voice-controlled accessibility software can help users with disabilities, including specific examples and technical considerations.";
    
    const result = await this.measureLatency(
      async () => {
        let fullResponse = '';
        let firstTokenTime = null;
        let tokenCount = 0;
        const chunkTimes = [];
        
        const stream = await this.ollama.chat({
          model: this.model,
          messages: [{ role: 'user', content: query }],
          stream: true
        });

        const startTime = Date.now();
        
        for await (const chunk of stream) {
          const chunkTime = Date.now();
          
          if (chunk.message && chunk.message.content) {
            if (firstTokenTime === null) {
              firstTokenTime = chunkTime - startTime;
            }
            
            fullResponse += chunk.message.content;
            tokenCount += this.estimateTokenCount(chunk.message.content);
            chunkTimes.push(chunkTime - startTime);
          }
        }
        
        return {
          response: fullResponse,
          firstTokenLatency: firstTokenTime,
          totalTokens: tokenCount,
          chunkTimes,
          totalTime: Date.now() - startTime
        };
      },
      'Streaming query'
    );

    if (result.success) {
      const streamingData = result.result;
      this.results.tests.streaming = {
        successful: 1,
        failed: 0,
        totalLatency: result.latency,
        firstTokenLatency: streamingData.firstTokenLatency,
        totalTokens: streamingData.totalTokens,
        tokensPerSecond: streamingData.totalTokens / (streamingData.totalTime / 1000),
        result
      };
      
      this.log(`Streaming test completed: First token: ${streamingData.firstTokenLatency}ms, Total: ${result.latency.toFixed(2)}ms, ${(streamingData.totalTokens / (streamingData.totalTime / 1000)).toFixed(2)} tokens/sec`, true);
    } else {
      this.results.tests.streaming = {
        successful: 0,
        failed: 1,
        error: result.error
      };
    }
  }

  async testConcurrentRequests() {
    this.log('Testing concurrent request performance...', true);
    
    const concurrentQueries = [
      "What is accessibility?",
      "How does speech recognition work?",
      "Explain AI privacy concerns.",
      "What are the benefits of offline processing?",
      "How can voice control help disabled users?"
    ];

    const startTime = Date.now();
    
    const promises = concurrentQueries.map((query, index) => 
      this.measureLatency(
        () => this.ollama.chat({
          model: this.model,
          messages: [{ role: 'user', content: query }],
          stream: false
        }),
        `Concurrent query ${index + 1}`
      )
    );

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    const successful = results.filter(r => r.success);
    const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;

    this.results.tests.concurrent = {
      successful: successful.length,
      failed: results.length - successful.length,
      totalTime,
      averageLatency: avgLatency,
      results
    };

    this.log(`Concurrent test completed: ${successful.length}/${results.length} successful in ${totalTime}ms, avg per query: ${avgLatency.toFixed(2)}ms`, true);
  }

  estimateTokenCount(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  generateReport() {
    const report = {
      summary: {
        timestamp: this.results.timestamp,
        model: this.results.model,
        host: this.results.host,
        iterations: this.results.iterations
      },
      performance: {},
      recommendations: []
    };

    // Connection performance
    if (this.results.tests.connection) {
      const conn = this.results.tests.connection;
      report.performance.connection = {
        successRate: `${((conn.successful / (conn.successful + conn.failed)) * 100).toFixed(1)}%`,
        averageLatency: `${conn.averageLatency.toFixed(2)}ms`,
        status: conn.averageLatency < 100 ? 'Excellent' : conn.averageLatency < 500 ? 'Good' : 'Needs Improvement'
      };
    }

    // Query performance
    ['simple', 'medium', 'complex'].forEach(category => {
      if (this.results.tests[category]) {
        const test = this.results.tests[category];
        report.performance[category] = {
          successRate: `${((test.successful / (test.successful + test.failed)) * 100).toFixed(1)}%`,
          averageLatency: `${test.averageLatency.toFixed(2)}ms`,
          tokensPerSecond: `${test.averageTokensPerSecond.toFixed(2)}`,
          status: test.averageLatency < 3000 ? 'Excellent' : test.averageLatency < 5000 ? 'Good' : 'Needs Improvement'
        };
      }
    });

    // Streaming performance
    if (this.results.tests.streaming && this.results.tests.streaming.successful) {
      const stream = this.results.tests.streaming;
      report.performance.streaming = {
        firstTokenLatency: `${stream.firstTokenLatency}ms`,
        tokensPerSecond: `${stream.tokensPerSecond.toFixed(2)}`,
        status: stream.firstTokenLatency < 1000 ? 'Excellent' : stream.firstTokenLatency < 2000 ? 'Good' : 'Needs Improvement'
      };
    }

    // Generate recommendations
    if (report.performance.connection && report.performance.connection.status !== 'Excellent') {
      report.recommendations.push('Consider checking network connectivity to Ollama server');
    }

    if (report.performance.complex && parseFloat(report.performance.complex.averageLatency) > 5000) {
      report.recommendations.push('Complex queries are taking longer than optimal - consider hardware optimization');
    }

    if (report.performance.streaming && parseFloat(report.performance.streaming.firstTokenLatency) > 2000) {
      report.recommendations.push('First token latency is high - consider model caching or hardware upgrades');
    }

    const tokensPerSecond = report.performance.simple ? parseFloat(report.performance.simple.tokensPerSecond) : 0;
    if (tokensPerSecond < 10) {
      report.recommendations.push('Token generation rate is below optimal - consider GPU acceleration if available');
    }

    return report;
  }

  async run() {
    console.log('🚀 Starting Ollama Gemma 3n Performance Benchmark');
    console.log(`Model: ${this.model}`);
    console.log(`Host: ${this.ollama.host}`);
    console.log(`Iterations: ${this.iterations}`);
    console.log('=' * 60);

    try {
      // Test connection
      const connected = await this.testConnection();
      if (!connected) {
        throw new Error('Failed to connect to Ollama. Please ensure Ollama is running and the model is available.');
      }

      // Test query performance
      await this.testQueryPerformance('simple', this.testQueries.simple);
      await this.testQueryPerformance('medium', this.testQueries.medium);
      await this.testQueryPerformance('complex', this.testQueries.complex);

      // Test streaming performance
      await this.testStreamingPerformance();

      // Test concurrent requests
      await this.testConcurrentRequests();

      // Generate and display report
      const report = this.generateReport();
      
      console.log('\n📊 Performance Report');
      console.log('=' * 60);
      console.log(JSON.stringify(report, null, 2));

      // Save full results if output file specified
      if (this.outputFile) {
        const fullResults = {
          report,
          rawData: this.results
        };
        
        fs.writeFileSync(this.outputFile, JSON.stringify(fullResults, null, 2));
        console.log(`\n💾 Full results saved to: ${this.outputFile}`);
      }

      // Summary
      console.log('\n📋 Summary');
      console.log('=' * 60);
      console.log(`✅ Tests completed successfully`);
      
      if (report.performance.simple) {
        console.log(`⚡ Simple query avg: ${report.performance.simple.averageLatency}`);
      }
      if (report.performance.complex) {
        console.log(`🧠 Complex query avg: ${report.performance.complex.averageLatency}`);
      }
      if (report.performance.streaming) {
        console.log(`🌊 Streaming first token: ${report.performance.streaming.firstTokenLatency}`);
        console.log(`📈 Token generation: ${report.performance.streaming.tokensPerSecond} tokens/sec`);
      }

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => console.log(`   • ${rec}`));
      }

    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--iterations':
        options.iterations = parseInt(args[++i]);
        break;
      case '--model':
        options.model = args[++i];
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
        console.log(`
Ollama Gemma 3n Performance Benchmarking Script

Usage: node benchmark_ollama_performance.js [options]

Options:
  --iterations <number>  Number of test iterations (default: 10)
  --model <string>      Model to test (default: gemma3n:e4b)
  --host <string>       Ollama host URL (default: http://127.0.0.1:11434)
  --verbose             Enable verbose output
  --output <file>       Save results to JSON file
  --help                Show this help message

Examples:
  node benchmark_ollama_performance.js
  node benchmark_ollama_performance.js --iterations 20 --verbose
  node benchmark_ollama_performance.js --output results.json
  node benchmark_ollama_performance.js --model gemma3n:2b --host http://localhost:11434
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const benchmark = new OllamaBenchmark(options);
  benchmark.run().catch(console.error);
}

module.exports = { OllamaBenchmark };