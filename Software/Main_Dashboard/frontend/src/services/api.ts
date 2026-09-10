import axios from 'axios';
import { SensorNode, Reading, Alert, LoRaPacket, SMSLog, BaselineStats, SystemHealth, SendSMSRequest } from '../types';

const API_BASE = 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

export const api = {
  getNodes: async (): Promise<SensorNode[]> => {
    const res = await apiClient.get<SensorNode[]>('/nodes');
    return res.data;
  },

  createNode: async (payload: any): Promise<SensorNode> => {
    const res = await apiClient.post<SensorNode>('/nodes', payload);
    return res.data;
  },

  getNodeById: async (id: number): Promise<SensorNode> => {
    const res = await apiClient.get<SensorNode>(`/nodes/${id}`);
    return res.data;
  },

  getReadings: async (nodeCode?: string, limit = 100): Promise<Reading[]> => {
    const params = { limit, ...(nodeCode ? { node_code: nodeCode } : {}) };
    const res = await apiClient.get<Reading[]>('/readings', { params });
    return res.data;
  },

  getAlerts: async (status?: string): Promise<Alert[]> => {
    const params = status ? { status } : {};
    const res = await apiClient.get<Alert[]>('/alerts', { params });
    return res.data;
  },

  acknowledgeAlert: async (alertId: number): Promise<any> => {
    const res = await apiClient.post(`/alerts/${alertId}/ack`);
    return res.data;
  },

  resolveAlert: async (alertId: number): Promise<any> => {
    const res = await apiClient.post(`/alerts/${alertId}/resolve`);
    return res.data;
  },

  getPackets: async (limit = 30): Promise<LoRaPacket[]> => {
    const res = await apiClient.get<LoRaPacket[]>('/packets', { params: { limit } });
    return res.data;
  },

  getSMSLogs: async (limit = 30): Promise<SMSLog[]> => {
    const res = await apiClient.get<SMSLog[]>('/sms', { params: { limit } });
    return res.data;
  },

  sendCitizenSMS: async (payload: SendSMSRequest): Promise<SMSLog> => {
    const res = await apiClient.post<SMSLog>('/sms/send', payload);
    return res.data;
  },

  getBaselines: async (nodeCode?: string): Promise<BaselineStats[]> => {
    const params = nodeCode ? { node_code: nodeCode } : {};
    const res = await apiClient.get<BaselineStats[]>('/baselines', { params });
    return res.data;
  },

  getSystemHealth: async (): Promise<SystemHealth> => {
    const res = await apiClient.get<SystemHealth>('/system/health');
    return res.data;
  },

  triggerEvent: async (eventType: string, speedMultiplier?: number) => {
    const res = await apiClient.post('/simulate/event', {
      event_type: eventType,
      speed_multiplier: speedMultiplier,
    });
    return res.data;
  }
};
