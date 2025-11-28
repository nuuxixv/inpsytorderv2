import React from 'react';
import { TableRow, TableCell, Skeleton } from '@mui/material';

/**
 * 테이블 데이터 로딩 시 보여줄 스켈레톤 컴포넌트
 * @param {number} rows - 표시할 행의 개수 (기본값: 5)
 * @param {number} columns - 표시할 열의 개수 (기본값: 5)
 */
const TableSkeleton = ({ rows = 5, columns = 5 }) => {
  return (
    <>
      {Array.from(new Array(rows)).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from(new Array(columns)).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton animation="wave" variant="text" height={30} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};

export default TableSkeleton;
