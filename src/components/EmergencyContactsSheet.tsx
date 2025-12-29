import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, User, Phone, Heart, Star, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  getEmergencyContacts, 
  addEmergencyContact, 
  deleteEmergencyContact,
  updateEmergencyContact,
  type EmergencyContact 
} from '@/lib/emergencyContacts';
import { useToast } from '@/components/ui/use-toast';

interface EmergencyContactsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmergencyContactsSheet({ isOpen, onClose }: EmergencyContactsSheetProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Load contacts on mount
  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);
  
  const loadContacts = async () => {
    const data = await getEmergencyContacts();
    setContacts(data);
  };
  
  const handleAddContact = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast({
        title: 'Required fields missing',
        description: 'Name and phone number are required',
        variant: 'destructive',
      });
      return;
    }
    
    // Basic phone validation
    const phoneRegex = /^[+]?[\d\s-]{10,}$/;
    if (!phoneRegex.test(newPhone.replace(/\s/g, ''))) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await addEmergencyContact({
        name: newName.trim(),
        phone: newPhone.trim(),
        relationship: newRelation.trim() || undefined,
        is_primary: contacts.length === 0, // First contact is primary
      });
      
      await loadContacts();
      setIsAdding(false);
      setNewName('');
      setNewPhone('');
      setNewRelation('');
      
      toast({
        title: 'Contact added',
        description: 'Emergency contact saved successfully',
      });
    } catch (e) {
      toast({
        title: 'Failed to add',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteEmergencyContact(id);
      await loadContacts();
      toast({
        title: 'Contact removed',
      });
    } catch (e) {
      toast({
        title: 'Failed to delete',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSetPrimary = async (id: string) => {
    setIsLoading(true);
    try {
      await updateEmergencyContact(id, { is_primary: true });
      await loadContacts();
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-background rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-hidden"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Emergency Contacts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {contacts.length === 0 && !isAdding && (
              <p className="text-center text-muted-foreground py-8">
                No emergency contacts yet.
                <br />
                <span className="text-sm">Add family members to notify during emergencies.</span>
              </p>
            )}
            
            {/* Contact List */}
            <div className="space-y-3">
              {contacts.map((contact) => (
                <motion.div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{contact.name}</p>
                      {contact.is_primary && (
                        <Star className="w-4 h-4 text-primary fill-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    {contact.relationship && (
                      <p className="text-xs text-muted-foreground/70">{contact.relationship}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    {!contact.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(contact.id)}
                        className="p-2 rounded-full hover:bg-primary/20 transition-colors"
                        title="Set as primary"
                        disabled={isLoading}
                      >
                        <Star className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="p-2 rounded-full hover:bg-destructive/20 transition-colors"
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Add Form */}
            {isAdding && (
              <motion.div
                className="mt-4 p-4 rounded-xl bg-secondary/30 space-y-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Phone number"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    type="tel"
                    className="flex-1"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Relationship (optional)"
                    value={newRelation}
                    onChange={(e) => setNewRelation(e.target.value)}
                    className="flex-1"
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setIsAdding(false)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddContact}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Footer */}
          {!isAdding && (
            <div className="p-4 border-t border-border">
              <Button
                onClick={() => setIsAdding(true)}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
