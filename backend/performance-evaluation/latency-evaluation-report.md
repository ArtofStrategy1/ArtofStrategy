# Latency Evaluation Report: Ollama Inference
    
**Date:** 2025-11-22 01:29:04
**Model Tested:** `llama3.1:latest`
**Runs:** 5 Pings, 10 Inference Calls per LXC

---

## Comparison of Latency

| Metric | LXC 1 (Local) | LXC 2 (Remote) | Difference (LXC 2 - LXC 1) |
| :--- | :---: | :---: | :---: |
| **T_inference (GPU/CPU Eval)** | **5.132306 s** | **0.976096 s** | **-4.156210 s** |
| **T_Total (Calculated)** | 5.132336 s | 0.977098 s | -4.155238 s |
| **Avg Total HTTP Round Trip** | 5.457691 s | 1.213096 s | -4.244596 s |

---

## Detailed Results per LXC


### LXC 1 (Local/CPU) Latency Performance Breakdown
* **IP Address:** `localhost`
* **Proxy URL:** `http://localhost:11434/api/generate`

| Metric | Value (Seconds) | Notes |
| :--- | :--- | :--- |
| **T_network (ICMP RTT)** | `0.000030` | Avg time for a network packet to reach the server. |
| **T_inference (GPU/CPU Eval)** | `5.132306` | Avg time Ollama reported for token generation. |
| **T_Total (Calculated)** | `5.132336` | Expected minimum total time (T\_network + T\_inference). |
| **Avg Total HTTP Round Trip** | `5.457691` | Actual time from request sent to response received. |


---


### LXC 2 (Remote/GPU) Latency Performance Breakdown
* **IP Address:** `192.168.2.200`
* **Proxy URL:** `https://ollama.data2int.com/api/generate`

| Metric | Value (Seconds) | Notes |
| :--- | :--- | :--- |
| **T_network (ICMP RTT)** | `0.001002` | Avg time for a network packet to reach the server. |
| **T_inference (GPU/CPU Eval)** | `0.976096` | Avg time Ollama reported for token generation. |
| **T_Total (Calculated)** | `0.977098` | Expected minimum total time (T\_network + T\_inference). |
| **Avg Total HTTP Round Trip** | `1.213096` | Actual time from request sent to response received. |


---

## Calculation Summary for Chapter 4

**LXC 1 (Local):** T\_Total = 0.000030 (Network) + 5.132306 (Inference) = **5.132336 seconds**

**LXC 2 (Remote):** T\_Total = 0.001002 (Network) + 0.976096 (Inference) = **0.977098 seconds**
