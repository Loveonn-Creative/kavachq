// Emergency contacts management
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './deviceId';

const CONTACTS_KEY = 'kavach_emergency_contacts';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  is_primary: boolean;
}

// Get contacts from localStorage
function getLocalContacts(): EmergencyContact[] {
  try {
    const data = localStorage.getItem(CONTACTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save contacts to localStorage
function saveLocalContacts(contacts: EmergencyContact[]): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

// Get all emergency contacts for this device
export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  const deviceId = getDeviceId();
  
  // Try to fetch from cloud first
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('device_id', deviceId)
        .order('is_primary', { ascending: false });
      
      if (!error && data) {
        const contacts = data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          relationship: c.relationship || undefined,
          is_primary: c.is_primary || false,
        }));
        saveLocalContacts(contacts);
        return contacts;
      }
    } catch (e) {
      console.warn('Failed to fetch contacts from cloud:', e);
    }
  }
  
  return getLocalContacts();
}

// Add a new emergency contact
export async function addEmergencyContact(
  contact: Omit<EmergencyContact, 'id'>
): Promise<EmergencyContact> {
  const deviceId = getDeviceId();
  const id = generateId();
  
  const newContact: EmergencyContact = {
    id,
    ...contact,
  };
  
  // Save locally first
  const contacts = getLocalContacts();
  
  // If this is primary, set others to non-primary
  if (contact.is_primary) {
    contacts.forEach(c => c.is_primary = false);
  }
  
  contacts.push(newContact);
  saveLocalContacts(contacts);
  
  // Sync to cloud
  if (navigator.onLine) {
    try {
      await supabase.from('emergency_contacts').insert({
        id,
        device_id: deviceId,
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship,
        is_primary: contact.is_primary,
      });
      
      // Update other contacts if this is primary
      if (contact.is_primary) {
        await supabase
          .from('emergency_contacts')
          .update({ is_primary: false })
          .eq('device_id', deviceId)
          .neq('id', id);
      }
    } catch (e) {
      console.warn('Failed to sync contact to cloud:', e);
    }
  }
  
  return newContact;
}

// Update an emergency contact
export async function updateEmergencyContact(
  id: string,
  updates: Partial<Omit<EmergencyContact, 'id'>>
): Promise<void> {
  const deviceId = getDeviceId();
  const contacts = getLocalContacts();
  const idx = contacts.findIndex(c => c.id === id);
  
  if (idx !== -1) {
    // If setting as primary, unset others
    if (updates.is_primary) {
      contacts.forEach(c => c.is_primary = false);
    }
    
    contacts[idx] = { ...contacts[idx], ...updates };
    saveLocalContacts(contacts);
    
    // Sync to cloud
    if (navigator.onLine) {
      try {
        await supabase
          .from('emergency_contacts')
          .update(updates)
          .eq('id', id)
          .eq('device_id', deviceId);
        
        if (updates.is_primary) {
          await supabase
            .from('emergency_contacts')
            .update({ is_primary: false })
            .eq('device_id', deviceId)
            .neq('id', id);
        }
      } catch (e) {
        console.warn('Failed to sync contact update:', e);
      }
    }
  }
}

// Delete an emergency contact
export async function deleteEmergencyContact(id: string): Promise<void> {
  const deviceId = getDeviceId();
  const contacts = getLocalContacts().filter(c => c.id !== id);
  saveLocalContacts(contacts);
  
  if (navigator.onLine) {
    try {
      await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id)
        .eq('device_id', deviceId);
    } catch (e) {
      console.warn('Failed to delete contact from cloud:', e);
    }
  }
}

// Get primary contact for emergencies
export async function getPrimaryContact(): Promise<EmergencyContact | null> {
  const contacts = await getEmergencyContacts();
  return contacts.find(c => c.is_primary) || contacts[0] || null;
}

// Notify emergency contacts (creates SMS-ready data)
export async function notifyEmergencyContacts(
  location?: { lat: number; lng: number }
): Promise<{ phone: string; message: string }[]> {
  const contacts = await getEmergencyContacts();
  
  const locationText = location 
    ? `Location: https://maps.google.com/?q=${location.lat},${location.lng}`
    : 'Location unavailable';
  
  const message = `🚨 EMERGENCY ALERT from KAVACH\n\nYour family member needs help!\n${locationText}\n\nThis is an automated alert.`;
  
  return contacts.map(c => ({
    phone: c.phone,
    message,
  }));
}
