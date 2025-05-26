'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, deleteDoc, addDoc } from 'firebase/firestore';
import { User, Group, Invitation, Property } from '@/lib/types';
import { AlertCircle, Check, X, UserPlus, Users, MapPin, Trash2, User as UserIcon, Crown, Shield, Home } from 'lucide-react';
import AddressInput from '../components/AddressInput';
import GroupMap from '../components/GroupMap';

export default function GroupPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Group state
  const [userGroup, setUserGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<(User & { id: string })[]>([]);
  const [groupProperties, setGroupProperties] = useState<Property[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMemberForAdmin, setSelectedMemberForAdmin] = useState('');
  const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);
  const [isDemotingAdmin, setIsDemotingAdmin] = useState(false);

  useEffect(() => {
    const fetchGroupData = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
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

          // Fetch group properties
          const propertiesSnapshot = await getDocs(collection(db, `groups/${groupData.id}/properties`));
          const properties = propertiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Property));
          setGroupProperties(properties);
        }
        
        // Fetch invitations
        const invitationsSnapshot = await getDocs(collection(db, `users/${user.uid}/invitations`));
        const invitationsList = invitationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Invitation));
        setInvitations(invitationsList);
        
      } catch (error) {
        console.error('Error fetching group data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGroupData();
  }, [user]);

  const isCreator = userGroup?.createdBy === user?.uid;
  const isAdmin = userGroup?.admins?.includes(user?.uid || '') || isCreator;

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    
    setIsCreatingGroup(true);
    
    try {
      let invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      let isUnique = false;
      
      // Keep generating codes until we find a unique one
      while (!isUnique) {
        invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
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
        admins: [], // Creator has admin privileges by default, no need to include in admins array
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
        admins: [],
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
        invitedByName: user.displayName || user.email,
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
        
        const deletePromises = invitationsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);
        
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
          
          // Refresh the page to show the new group
          window.location.reload();
        }
      } else {
        // If declining, just remove this specific invitation
        await deleteDoc(doc(db, `users/${user.uid}/invitations`, invitation.id));
        setInvitations(invitations.filter(inv => inv.id !== invitation.id));
      }
    } catch (error) {
      console.error('Error handling invitation:', error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!user || !userGroup || !isCreator) return;
    
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone and will remove all group data including properties.')) return;
    
    try {
      // Delete all properties in the group
      const propertiesSnapshot = await getDocs(collection(db, `groups/${userGroup.id}/properties`));
      const deletePropertyPromises = propertiesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePropertyPromises);

      // Update all members to remove groupId
      const memberUpdatePromises = userGroup.members.map(memberId =>
        updateDoc(doc(db, 'users', memberId), {
          groupId: null,
          updatedAt: Date.now()
        })
      );
      await Promise.all(memberUpdatePromises);

      // Delete the group
      await deleteDoc(doc(db, 'groups', userGroup.id));
      
      setUserGroup(null);
      router.push('/');
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (!user || !userGroup || !isAdmin || memberId === userGroup.createdBy) return;
    
    const member = groupMembers.find(m => m.id === memberId);
    if (!confirm(`Are you sure you want to remove ${member?.displayName || member?.email} from the group?`)) return;
    
    try {
      // Remove member from group
      const updatedMembers = userGroup.members.filter(id => id !== memberId);
      const updatedAdmins = userGroup.admins.filter(id => id !== memberId);
      
      await updateDoc(doc(db, 'groups', userGroup.id), {
        members: updatedMembers,
        admins: updatedAdmins
      });
      
      // Remove groupId from user
      await updateDoc(doc(db, 'users', memberId), {
        groupId: null,
        updatedAt: Date.now()
      });
      
      // Update local state
      setUserGroup({
        ...userGroup,
        members: updatedMembers,
        admins: updatedAdmins
      });
      setGroupMembers(groupMembers.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Error kicking member:', error);
    }
  };

  const handlePromoteToAdmin = async (memberId: string) => {
    if (!user || !userGroup || !isCreator || memberId === userGroup.createdBy) return;
    
    setIsPromotingAdmin(true);
    
    try {
      const updatedAdmins = [...(userGroup.admins || []), memberId];
      
      await updateDoc(doc(db, 'groups', userGroup.id), {
        admins: updatedAdmins
      });
      
      // Update local state
      setUserGroup({
        ...userGroup,
        admins: updatedAdmins
      });
    } catch (error) {
      console.error('Error promoting to admin:', error);
    } finally {
      setIsPromotingAdmin(false);
    }
  };

  const handleDemoteAdmin = async (memberId: string) => {
    if (!user || !userGroup || !isCreator || memberId === userGroup.createdBy) return;
    
    setIsDemotingAdmin(true);
    
    try {
      const updatedAdmins = (userGroup.admins || []).filter(id => id !== memberId);
      
      await updateDoc(doc(db, 'groups', userGroup.id), {
        admins: updatedAdmins
      });
      
      // Update local state
      setUserGroup({
        ...userGroup,
        admins: updatedAdmins
      });
    } catch (error) {
      console.error('Error demoting admin:', error);
    } finally {
      setIsDemotingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-700 font-medium">Loading group...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Group Management</h1>
        
        {/* User's Current Group */}
        {userGroup ? (
          <div className="space-y-8">
            {/* Group Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                    <Users className="mr-2" size={24} />
                    {userGroup.name}
                  </h2>
                  <p className="text-gray-700 mb-2">Invitation Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded border">{userGroup.invitationCode}</span></p>
                  <p className="text-sm text-gray-600">Share this code with friends or use the email invitation below</p>
                </div>
                {isCreator && (
                  <button
                    onClick={handleDeleteGroup}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center"
                  >
                    <Trash2 size={18} className="mr-2" />
                    Delete Group
                  </button>
                )}
              </div>
              
              {/* Group Members */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Group Members</h3>
                <div className="space-y-2">
                  {groupMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                      <div className="flex items-center space-x-3">
                        {member.photoURL ? (
                          <img 
                            src={member.photoURL} 
                            alt={member.displayName || member.email}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <UserIcon size={20} className="text-gray-500" />
                        )}
                        <span className="text-sm text-gray-700">
                          {member.displayName || member.email}
                        </span>
                        {member.id === userGroup.createdBy && (
                          <div title="Creator">
                            <Crown size={16} className="text-yellow-500" />
                          </div>
                        )}
                        {userGroup.admins?.includes(member.id) && member.id !== userGroup.createdBy && (
                          <div title="Admin">
                            <Shield size={16} className="text-blue-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isCreator && member.id !== userGroup.createdBy && (
                          <>
                            {userGroup.admins?.includes(member.id) ? (
                              <button
                                onClick={() => handleDemoteAdmin(member.id)}
                                disabled={isDemotingAdmin}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                                title="Demote from admin"
                              >
                                <Shield size={16} className="mr-1" />
                                Demote
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePromoteToAdmin(member.id)}
                                disabled={isPromotingAdmin}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                                title="Promote to admin"
                              >
                                <Shield size={16} className="mr-1" />
                                Make Admin
                              </button>
                            )}
                          </>
                        )}
                        {isAdmin && member.id !== userGroup.createdBy && member.id !== user?.uid && (
                          <button
                            onClick={() => handleKickMember(member.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite Members */}
              {isAdmin && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Invite a Friend</h3>
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
              )}
            </div>

            {/* Team Workplace Map */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <MapPin className="mr-2" size={24} />
                Team Workplace & Properties Map
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                This map shows the workplace locations of all members in your group and the locations of your properties
              </p>
              <GroupMap members={groupMembers} properties={groupProperties} />
            </div>
          </div>
        ) : (
          /* Create New Group */
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Users className="mr-2" size={24} />
              Create a New Group
            </h2>
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

        {/* Invitations */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Group Invitations</h2>
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
    </ProtectedRoute>
  );
}
