-- Enable realtime for user_roles table to detect suspension changes in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE user_roles;