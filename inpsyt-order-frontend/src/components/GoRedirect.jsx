import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../supabaseClient';

const GoRedirect = () => {
  const [loading, setLoading] = useState(true);
  const [noEvent, setNoEvent] = useState(false);

  useEffect(() => {
    const fetchActiveEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('active_event_slug')
          .single();

        if (error) throw error;

        if (data?.active_event_slug) {
          window.location.replace('/order?events=' + data.active_event_slug);
        } else {
          setNoEvent(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching active event:', err);
        setNoEvent(true);
        setLoading(false);
      }
    };

    fetchActiveEvent();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (noEvent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h6" color="text.secondary">
          현재 운영 중인 학회가 없습니다.
        </Typography>
      </Box>
    );
  }

  return null;
};

export default GoRedirect;
