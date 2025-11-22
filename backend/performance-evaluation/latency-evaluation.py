import requests
import time
import statistics
import subprocess
import re
import os # Import os for path joining

# Configuration
LXC1_IP = "localhost"  # IP of your Inference Server (LXC 1)
LXC1_PROXY_URL = "http://localhost:11434/api/generate" # Proxy URL for LXC 1
LXC2_IP = "192.168.2.200"  # IP of your Inference Server (LXC 2)
PROXY_URL = "https://ollama.data2int.com/api/generate" # Proxy URL for LXC 2
MODEL_NAME = "llama3.1:latest" # Model tag
OUTPUT_FILE = "comparative_latency_report.md" # Define the output filename

# --- Network Latency Function (Modified for silence) ---

def measure_network_latency(host, runs=5):
    latencies = []
    time_pattern = re.compile(r"time=(\d+\.?\d*)\s*ms")
    
    # print(f"--- Pinging {host} {runs} times using external ping ---") # Removed for silent measurement
    for _ in range(runs):
        try:
            result = subprocess.run(
                ['ping', '-c', '1', host], 
                capture_output=True, 
                text=True, 
                check=True, 
                timeout=2
            )
            
            match = time_pattern.search(result.stdout)
            if match:
                rtt_ms = float(match.group(1))
                rtt_s = rtt_ms / 1000.0
                latencies.append(rtt_s)
            
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            pass # Fail silently
            
        time.sleep(0.1)
    
    if not latencies:
        # print("Could not collect any valid network latencies.") # Removed for silent measurement
        return 0.0

    avg_latency = statistics.mean(latencies)
    # print(f"Average Network Latency (T_network): {avg_latency:.6f} seconds") # Removed for silent measurement
    return avg_latency

# --- Inference Latency Function (Modified to return two values for better report detail) ---

def measure_inference_latency(url, runs=10):
    inference_times = []
    total_times = []
    
    payload = {
        "model": MODEL_NAME,
        "prompt": "Explain strategy in one sentence.",
        "stream": False
    }
    
    # print(f"--- Triggering Inference {runs} times ---") # Removed for silent measurement
    for _ in range(runs):
        start_real = time.perf_counter()
        try:
            response = requests.post(url, json=payload, timeout=30) # Added a timeout for safety
            end_real = time.perf_counter()
            
            if response.status_code == 200:
                data = response.json()
                t_inference = data.get('eval_duration', 0) / 1e9 
                inference_times.append(t_inference)
                total_times.append(end_real - start_real)
            else:
                # print(f"Error: {response.status_code} - {response.text[:100]}...") # Removed for silent measurement
                pass
        except requests.exceptions.RequestException:
            pass # Handle network/connection errors silently

        time.sleep(0.1)

    if not inference_times:
        # print("Could not collect any valid inference times.") # Removed for silent measurement
        return 0.0, 0.0
        
    avg_inf = statistics.mean(inference_times)
    avg_total = statistics.mean(total_times)
    
    # print(f"Average Inference Time (T_inference): {avg_inf:.6f} seconds") # Removed for silent measurement
    # print(f"Average Total HTTP Round Trip: {avg_total:.6f} seconds") # Removed for silent measurement
    return avg_inf, avg_total 

# --- New Main Execution Block for Comparative Markdown Output ---

def format_lxc_table(lxc_name, ip, proxy, net_time, avg_inf, avg_total_http):
    """Generates a Markdown table string for a single LXC's results."""
    
    total_calc = net_time + avg_inf
    
    return f"""
### {lxc_name} Performance Breakdown
* **IP Address:** `{ip}`
* **Proxy URL:** `{proxy}`

| Metric | Value (Seconds) | Notes |
| :--- | :--- | :--- |
| **T_network (ICMP RTT)** | `{net_time:.6f}` | Avg time for a network packet to reach the server. |
| **T_inference (GPU/CPU Eval)** | `{avg_inf:.6f}` | Avg time Ollama reported for token generation. |
| **T_Total (Calculated)** | `{total_calc:.6f}` | Expected minimum total time (T\_network + T\_inference). |
| **Avg Total HTTP Round Trip** | `{avg_total_http:.6f}` | Actual time from request sent to response received. |
"""

if __name__ == "__main__":
    
    # 1. Run all measurements
    print("Starting measurements...")
    
    # LXC 1 Measurements
    net_time1 = measure_network_latency(LXC1_IP)
    inf_time1, http_total1 = measure_inference_latency(LXC1_PROXY_URL)
    
    # LXC 2 Measurements
    net_time2 = measure_network_latency(LXC2_IP)
    inf_time2, http_total2 = measure_inference_latency(PROXY_URL)
    
    print("Measurements complete. Generating report...")
    
    # 2. Generate Markdown Tables
    lxc1_table = format_lxc_table("LXC 1 (Local/CPU)", LXC1_IP, LXC1_PROXY_URL, net_time1, inf_time1, http_total1)
    lxc2_table = format_lxc_table("LXC 2 (Remote/GPU)", LXC2_IP, PROXY_URL, net_time2, inf_time2, http_total2)
    
    # 3. Compile the full Markdown content
    markdown_content = f"""# 📊 Comparative Performance Report: Ollama Inference
    
**Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}
**Model Tested:** `{MODEL_NAME}`
**Runs:** 5 Pings, 10 Inference Calls per LXC

---

## Comparison of Performance

| Metric | LXC 1 (Local) | LXC 2 (Remote) | Difference (LXC 2 - LXC 1) |
| :--- | :---: | :---: | :---: |
| **T_inference (GPU/CPU Eval)** | **{inf_time1:.6f} s** | **{inf_time2:.6f} s** | **{inf_time2 - inf_time1:.6f} s** |
| **T_Total (Calculated)** | {net_time1 + inf_time1:.6f} s | {net_time2 + inf_time2:.6f} s | { (net_time2 + inf_time2) - (net_time1 + inf_time1):.6f} s |
| **Avg Total HTTP Round Trip** | {http_total1:.6f} s | {http_total2:.6f} s | {http_total2 - http_total1:.6f} s |

---

## Detailed Results per LXC

{lxc1_table}

---

{lxc2_table}

---

## Calculation Summary for Chapter 4

**LXC 1 (Local):** T\_Total = {net_time1:.6f} (Network) + {inf_time1:.6f} (Inference) = **{net_time1 + inf_time1:.6f} seconds**

**LXC 2 (Remote):** T\_Total = {net_time2:.6f} (Network) + {inf_time2:.6f} (Inference) = **{net_time2 + inf_time2:.6f} seconds**
"""
    
    # 4. Write the content to the Markdown file
    try:
        with open(OUTPUT_FILE, "w") as f:
            f.write(markdown_content)
        
        # 5. Provide console confirmation
        print(f"\nSuccessfully wrote comparative report to: **{os.path.abspath(OUTPUT_FILE)}**")
        
    except IOError as e:
        print(f"Error writing to file {OUTPUT_FILE}: {e}")