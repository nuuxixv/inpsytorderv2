import React, { useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useNotification } from '../NotificationContext';

const NotificationsDisplay = () => {
  const { notifications } = useNotification();
  const [open, setOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);

  useEffect(() => {
    if (notifications.length > 0) {
      // Display the latest notification
      setCurrentNotification(notifications[0]);
      setOpen(true);
    }
  }, [notifications]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  if (!currentNotification) {
    return null;
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert onClose={handleClose} severity={currentNotification.severity} sx={{ width: '100%' }}>
        {currentNotification.message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationsDisplay;