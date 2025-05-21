'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, where, deleteDoc, addDoc } from 'firebase/firestore';
import { User, Group, Invitation } from '@/lib/types';
import { AlertCircle, Check, X, UserPlus, Users, MapPin, LogOut, User as UserIcon } from 'lucide-react';
import AddressInput from '../components/AddressInput';
import GroupMap from '../components/GroupMap';

export default function Settings() {
  const { user } = useAuth();
  const router = useRouter();
  
  // User profile state
  const [displayName, setDisplayName] = useState('');
  const [workplaceAddress, setWorkplaceAddress] = useState('');
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', message: '' });
  
  // Group state
  const [userGroup, setUserGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<(User & { id: string })[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState({ type: '', message: '' });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setDisplayName(userData.displayName || '');
          setWorkplaceAddress(userData.workplaceAddress || '');
        }
        
        // Fetch user's group
        const groupsQuery = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
        const groupsSnapshot = await getDocs(groupsQuery);
        
        if (!groupsSnapshot.empty) {
          const groupData = {
            id: groupsSnapshot.docs[0].id,
            ...groupsSnapshot.docs[0].data()
          } as Group;
          setUserGroup(groupData);

          // Fetch group members' information
          const memberPromises = groupData.members.map(memberId => 
            getDoc(doc(db, 'users', memberId))
          );
          const memberDocs = await Promise.all(memberPromises);
          const members = memberDocs
            .filter(doc => doc.exists())
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as User & { id: string }));
          setGroupMembers(members);
        }
        
        // Fetch invitations
        const invitationsSnapshot = await getDocs(collection(db, `users/${user.uid}/invitations`));
        const invitationsList = invitationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Invitation));
        setInvitations(invitationsList);
        
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (!isAddressValid) {
      setSaveMessage({ type: 'error', message: 'Please select a valid workplace address from the suggestions.' });
      return;
    }
    
    setIsSaving(true);
    setSaveMessage({ type: '', message: '' });
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        workplaceAddress,
        updatedAt: Date.now()
      });
      
      setSaveMessage({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveMessage({ type: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    
    setIsCreatingGroup(true);
    
    try {
      let invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      let isUnique = false;
      
      // Keep generating codes until we find a unique one
      while (!isUnique) {
        // Generate a random 6-character invitation code
        invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Check if this code already exists
        const existingGroupsQuery = query(collection(db, 'groups'), where('invitationCode', '==', invitationCode));
        const existingGroupsSnapshot = await getDocs(existingGroupsQuery);
        
        if (existingGroupsSnapshot.empty) {
          isUnique = true;
        }
      }
      
      // Create the new group
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        createdBy: user.uid,
        createdAt: Date.now(),
        members: [user.uid],
        invitationCode
      });
      
      // Update user's groupId
      await updateDoc(doc(db, 'users', user.uid), {
        groupId: groupRef.id,
        updatedAt: Date.now()
      });
      
      // Update local state
      setUserGroup({
        id: groupRef.id,
        name: newGroupName.trim(),
        createdBy: user.uid,
        createdAt: Date.now(),
        members: [user.uid],
        invitationCode
      });
      
      setNewGroupName('');
      setIsCreatingGroup(false);
    } catch (error) {
      console.error('Error creating group:', error);
      setIsCreatingGroup(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!user || !userGroup || !inviteEmail.trim()) return;
    
    setIsInviting(true);
    setInviteMessage({ type: '', message: '' });
    
    try {
      // Check if the email belongs to a user in the system
      const usersQuery = query(collection(db, 'users'), where('email', '==', inviteEmail.trim()));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        setInviteMessage({ type: 'error', message: 'No user found with this email address.' });
        setIsInviting(false);
        return;
      }
      
      const inviteeId = usersSnapshot.docs[0].id;
      
      // Check if user is already in a group
      const inviteeGroupsQuery = query(collection(db, 'groups'), where('members', 'array-contains', inviteeId));
      const inviteeGroupsSnapshot = await getDocs(inviteeGroupsQuery);
      
      if (!inviteeGroupsSnapshot.empty) {
        setInviteMessage({ type: 'error', message: 'This user is already a member of another group.' });
        setIsInviting(false);
        return;
      }
      
      // Check if invitation already exists
      const existingInvitationsQuery = query(
        collection(db, `users/${inviteeId}/invitations`), 
        where('groupId', '==', userGroup.id)
      );
      const existingInvitationsSnapshot = await getDocs(existingInvitationsQuery);
      
      if (!existingInvitationsSnapshot.empty) {
        setInviteMessage({ type: 'error', message: 'An invitation has already been sent to this user.' });
        setIsInviting(false);
        return;
      }
      
      // Create the invitation
      await addDoc(collection(db, `users/${inviteeId}/invitations`), {
        groupId: userGroup.id,
        groupName: userGroup.name,
        invitedBy: user.uid,
        invitedByName: displayName || user.email,
        invitationCode: userGroup.invitationCode,
        createdAt: Date.now()
      });
      
      setInviteMessage({ type: 'success', message: 'Invitation sent successfully!' });
      setInviteEmail('');
    } catch (error) {
      console.error('Error sending invitation:', error);
      setInviteMessage({ type: 'error', message: 'Failed to send invitation. Please try again.' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleInvitationResponse = async (invitation: Invitation, accept: boolean) => {
    if (!user) return;
    
    try {
      if (accept) {
        // Delete all pending invitations
        const invitationsRef = collection(db, `users/${user.uid}/invitations`);
        const invitationsSnapshot = await getDocs(invitationsRef);
        
        // Delete all invitations in parallel
        const deletePromises = invitationsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);
        
        // Update local state to clear all invitations
        setInvitations([]);
        
        // Add user to the group
        const groupRef = doc(db, 'groups', invitation.groupId);
        const groupDoc = await getDoc(groupRef);
        
        if (groupDoc.exists()) {
          const groupData = groupDoc.data() as Group;
          await updateDoc(groupRef, {
            members: [...groupData.members, user.uid]
          });
          
          // Update user's groupId
          await updateDoc(doc(db, 'users', user.uid), {
            groupId: invitation.groupId,
            updatedAt: Date.now()
          });
          
          // Update local state
          setUserGroup({
            id: invitation.groupId,
            name: invitation.groupName,
            invitationCode: invitation.invitationCode,
            members: [...groupData.members, user.uid],
            createdBy: groupData.createdBy,
            createdAt: groupData.createdAt
          });
        }
      } else {
        // If declining, just remove this specific invitation
        await deleteDoc(doc(db, `users/${user.uid}/invitations`, invitation.id));
        
        // Update local state
        setInvitations(invitations.filter(inv => inv.id !== invitation.id));
      }
    } catch (error) {
      console.error('Error handling invitation:', error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !userGroup) return;
    
    if (!confirm('Are you sure you want to leave this group?')) return;
    
    try {
      const groupRef = doc(db, 'groups', userGroup.id);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        const groupData = groupDoc.data() as Group;
        
        if (groupData.createdBy === user.uid) {
          // If the user is the creator, delete the group
          await deleteDoc(groupRef);
        } else {
          // Otherwise, just remove the user from the group
          await updateDoc(groupRef, {
            members: groupData.members.filter(memberId => memberId !== user.uid)
          });
        }
        
        setUserGroup(null);
      }
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        
        {/* User Profile Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <UserIcon className="mr-2" size={24} />
            Profile Settings
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                placeholder="Your display name"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
              <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
            </div>
            
            <AddressInput
              value={workplaceAddress}
              onChange={setWorkplaceAddress}
              onValidityChange={setIsAddressValid}
              label="Workplace Address"
              placeholder="Enter your workplace address"
              helperText="This will help calculate commute times to properties"
            />
            
            {saveMessage.message && (
              <div className={`p-3 rounded-md ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {saveMessage.message}
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              
              <button
                onClick={handleSignOut}
                className="flex items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                <LogOut size={18} className="mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
        
        {/* Group Management Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Users className="mr-2" size={24} />
            Group Management
          </h2>
          
          {/* User's Current Group */}
          {userGroup ? (
            <div className="mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Group: {userGroup.name}</h3>
                <p className="text-gray-700 mb-2">Invitation Code: <span className="font-mono bg-white px-2 py-1 rounded border">{userGroup.invitationCode}</span></p>
                <p className="text-sm text-gray-600 mb-4">Share this code with friends or use the email invitation below</p>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Group Members</h4>
                  <div className="space-y-2">
                    {groupMembers.map(member => (
                      <div key={member.id} className="flex items-center space-x-2 bg-white rounded-md p-2">
                        <UserIcon size={16} className="text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {member.displayName || member.email}
                          {member.id === userGroup.createdBy && (
                            <span className="ml-2 text-xs text-blue-600">(Creator)</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Invite a Friend</h4>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                  <button
                    onClick={handleSendInvitation}
                    disabled={isInviting || !inviteEmail.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                  >
                    <UserPlus size={18} className="mr-2" />
                    {isInviting ? 'Sending...' : 'Invite'}
                  </button>
                </div>
                
                {inviteMessage.message && (
                  <div className={`mt-2 p-3 rounded-md ${inviteMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {inviteMessage.message}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLeaveGroup}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Leave Group
              </button>
            </div>
          ) : (
            /* Create New Group */
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Create a New Group</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isCreatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </div>
          )}
          
          {userGroup && (
            <div className="mb-8">
              {/* Existing group info code */}
              
              {/* Add the Group Map */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Team Workplace Map</h3>
                <p className="text-sm text-gray-700 mb-4">
                  This map shows the workplace locations of all members in your group
                </p>
                <GroupMap members={groupMembers} />
              </div>
              
              {/* Rest of the existing group code */}
            </div>
          )}

          {/* Invitations */}
          {invitations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Group Invitations</h3>
              <div className="space-y-3">
                {invitations.map(invitation => (
                  <div key={invitation.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">
                        {invitation.groupName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Invited by {invitation.invitedByName}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleInvitationResponse(invitation, true)}
                        className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700"
                        title="Accept"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => handleInvitationResponse(invitation, false)}
                        className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                        title="Decline"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}