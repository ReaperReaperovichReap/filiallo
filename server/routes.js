const express = require('express');
const db = require('./db');

const router = express.Router();

// Валидация ID
const validateId = (id) => {
    const num = parseInt(id);
    return !isNaN(num) && num > 0;
};

// Обработка ошибок базы данных
const handleDbError = (err, res) => {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
};

// Получение всех филиалов
router.get('/api/branches', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, branch_name, parent_id 
            FROM branches 
            ORDER BY branch_name
        `);
        res.json(rows);
    } catch (err) {
        handleDbError(err, res);
    }
});

// Получение всех сотрудников с дополнительной информацией
router.get('/api/employees', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT e.*, p.position_name, b.branch_name
            FROM employees e
            JOIN positions p ON e.position_id = p.id
            JOIN branches b ON e.branch_id = b.id
            ORDER BY e.full_name
        `);
        res.json(rows);
    } catch (err) {
        handleDbError(err, res);
    }
});

// Получение всех должностей
router.get('/api/positions', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, position_name 
            FROM positions 
            ORDER BY position_name
        `);
        res.json(rows);
    } catch (err) {
        handleDbError(err, res);
    }
});

// Получение сотрудников филиала и всех его подразделений
router.get('/api/branches/:id/employees', async (req, res) => {
    try {
        if (!validateId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid branch ID' });
        }

        const { rows } = await db.query(`
            WITH RECURSIVE branch_tree AS (
                SELECT id FROM branches WHERE id = $1
                UNION
                SELECT b.id FROM branches b
                JOIN branch_tree bt ON b.parent_id = bt.id
            )
            SELECT e.*, p.position_name, b.branch_name
            FROM employees e
            JOIN positions p ON e.position_id = p.id
            JOIN branches b ON e.branch_id = b.id
            WHERE e.branch_id IN (SELECT id FROM branch_tree)
            ORDER BY e.full_name
        `, [req.params.id]);

        res.json(rows);
    } catch (err) {
        handleDbError(err, res);
    }
});

// Добавление сотрудника с валидацией
router.post('/api/employees', async (req, res) => {
    const { full_name, birth_date, position_id, branch_id, salary, hire_date } = req.body;

    // Базовая валидация
    if (!full_name || !birth_date || !position_id || !branch_id || !salary || !hire_date) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Проверка существования должности и филиала
        const [positionCheck, branchCheck] = await Promise.all([
            db.query('SELECT id FROM positions WHERE id = $1', [position_id]),
            db.query('SELECT id FROM branches WHERE id = $1', [branch_id])
        ]);

        if (positionCheck.rows.length === 0 || branchCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid position or branch' });
        }

        const { rows } = await db.query(
            `INSERT INTO employees 
            (full_name, birth_date, position_id, branch_id, salary, hire_date) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *`,
            [full_name, birth_date, position_id, branch_id, salary, hire_date]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        handleDbError(err, res);
    }
});

// Удаление сотрудника с проверкой существования
router.delete('/api/employees/:id', async (req, res) => {
    try {
        if (!validateId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid employee ID' });
        }

        const { rowCount } = await db.query(
            'DELETE FROM employees WHERE id = $1',
            [req.params.id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.status(204).end();
    } catch (err) {
        handleDbError(err, res);
    }
});

module.exports = router;